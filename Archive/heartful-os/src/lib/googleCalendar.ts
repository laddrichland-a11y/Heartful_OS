import { google, calendar_v3 } from "googleapis";
import * as data from "@/lib/data";

// ---------------------------------------------------------------------------
// Thin wrapper around the Google Calendar API (OAuth client, token
// persistence, and the handful of calendar operations the sync engine
// needs). Kept separate from lib/googleCalendarSync.ts, which owns the
// actual two-way sync *logic* (what to do with the events this file
// fetches/pushes).
//
// One practitioner, one Google account — there's no per-user token table,
// just a single settings/token doc at Firestore meta/googleCalendar (see
// data.ts getGoogleCalendarSettings / saveGoogleCalendarSettings).
// ---------------------------------------------------------------------------

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

export const isGoogleOAuthConfigured = Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);

export const HEARTFUL_CALENDAR_NAME = "Heartful OS";
export const PRIMARY_CALENDAR_ID = "primary";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

function newOAuthClient() {
  if (!isGoogleOAuthConfigured) {
    throw new Error(
      "Google OAuth is not configured — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI."
    );
  }
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

// Step 1 of the connect flow: where we send the practitioner to grant access.
export function buildGoogleAuthUrl(state?: string): string {
  const client = newOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // required to receive a refresh_token
    prompt: "consent", // forces Google to re-issue a refresh_token even on reconnect
    scope: SCOPES,
    state,
  });
}

// Step 2: exchange the ?code= Google redirects back with for tokens, and
// persist them. Returns the authorized client so the caller can immediately
// use it (e.g. to create the dedicated calendar) without a second round trip.
export async function exchangeCodeAndSaveTokens(code: string) {
  const client = newOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  let email: string | undefined;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    email = me.data.email ?? undefined;
  } catch {
    // Non-fatal — email is just for display in Settings.
  }

  await data.saveGoogleCalendarSettings({
    connected: true,
    connected_email: email,
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    token_expiry: tokens.expiry_date ?? undefined,
  });

  return client;
}

// Loads a ready-to-use, authorized client from saved tokens. Persists
// rotated access tokens (and a fresh refresh_token, if Google ever issues
// one) back to Firestore automatically via the 'tokens' event googleapis
// emits whenever it refreshes the access token under the hood.
export async function getAuthorizedClient() {
  const settings = await data.getGoogleCalendarSettings();
  if (!settings.connected || !settings.refresh_token) return null;

  const client = newOAuthClient();
  client.setCredentials({
    access_token: settings.access_token,
    refresh_token: settings.refresh_token,
    expiry_date: settings.token_expiry,
  });

  client.on("tokens", (tokens) => {
    const patch: Record<string, unknown> = {};
    if (tokens.access_token) patch.access_token = tokens.access_token;
    if (tokens.refresh_token) patch.refresh_token = tokens.refresh_token;
    if (tokens.expiry_date) patch.token_expiry = tokens.expiry_date;
    if (Object.keys(patch).length > 0) {
      data.saveGoogleCalendarSettings(patch).catch((err) => console.error("Failed to persist refreshed Google tokens:", err));
    }
  });

  return client;
}

export async function disconnectGoogle() {
  const client = await getAuthorizedClient();
  if (client) {
    try {
      await client.revokeCredentials();
    } catch (err) {
      console.error("Failed to revoke Google credentials (continuing to clear local state):", err);
    }
  }
  await data.clearGoogleCalendarSettings();
}

function calendarClient(auth: InstanceType<typeof google.auth.OAuth2>) {
  return google.calendar({ version: "v3", auth });
}

// Finds (or creates, on first connect) the dedicated "Heartful OS" calendar
// in the practitioner's Google account. Sessions and ProspectCalls are
// mirrored here so they don't clutter their personal/primary calendar.
export async function ensureHeartfulCalendar(auth: InstanceType<typeof google.auth.OAuth2>): Promise<string> {
  const settings = await data.getGoogleCalendarSettings();
  if (settings.heartful_calendar_id) return settings.heartful_calendar_id;

  const cal = calendarClient(auth);
  const list = await cal.calendarList.list();
  const existing = list.data.items?.find((c) => c.summary === HEARTFUL_CALENDAR_NAME);
  let calendarId: string;
  if (existing?.id) {
    calendarId = existing.id;
  } else {
    const created = await cal.calendars.insert({ requestBody: { summary: HEARTFUL_CALENDAR_NAME } });
    calendarId = created.data.id!;
  }
  await data.saveGoogleCalendarSettings({ heartful_calendar_id: calendarId });
  return calendarId;
}

export interface HeartfulEventInput {
  title: string;
  description?: string;
  startIso: string;
  durationMinutes: number;
  kind: "session" | "prospect_call";
  localId: string;
}

// Creates or updates (if existingEventId is passed) a mirrored event, tagged
// with the local record's id in extendedProperties so the pull side of sync
// can recognize it as ours (vs. an event the practitioner created directly
// in Google) and avoid re-importing our own writes.
export async function upsertHeartfulEvent(
  auth: InstanceType<typeof google.auth.OAuth2>,
  calendarId: string,
  input: HeartfulEventInput,
  existingEventId?: string
): Promise<calendar_v3.Schema$Event> {
  const cal = calendarClient(auth);
  const start = new Date(input.startIso);
  const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);
  const requestBody: calendar_v3.Schema$Event = {
    summary: input.title,
    description: input.description,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: {
      private: {
        heartfulId: input.localId,
        heartfulKind: input.kind,
      },
    },
  };

  if (existingEventId) {
    try {
      const res = await cal.events.update({ calendarId, eventId: existingEventId, requestBody });
      return res.data;
    } catch (err: unknown) {
      // 404/410 means the event we think we own is gone on Google's side —
      // the practitioner deleted it by hand, or it was removed by a cancel
      // whose local cleanup didn't land. Re-create it rather than failing the
      // whole push, otherwise a rescheduled session stays invisible on Google
      // forever with no error the practitioner ever sees.
      const status = (err as { code?: number; response?: { status?: number } })?.code
        ?? (err as { response?: { status?: number } })?.response?.status;
      if (status !== 404 && status !== 410) throw err;
    }
  }
  const res = await cal.events.insert({ calendarId, requestBody });
  return res.data;
}

export async function deleteHeartfulEvent(
  auth: InstanceType<typeof google.auth.OAuth2>,
  calendarId: string,
  eventId: string
): Promise<void> {
  const cal = calendarClient(auth);
  try {
    await cal.events.delete({ calendarId, eventId });
  } catch (err: unknown) {
    // 404/410 just means it's already gone on Google's side — fine.
    const status = (err as { code?: number; response?: { status?: number } })?.code
      ?? (err as { response?: { status?: number } })?.response?.status;
    if (status !== 404 && status !== 410) throw err;
  }
}

// Removes every event on the Heartful calendar tagged with this local record
// id, whether or not we have its event id stored locally.
//
// Why the lookup rather than just deleting google_event_id: the push helpers
// in actions.ts are fire-and-forget, so the create-push for a new session and
// the cancel-push for that same session can be in flight at once. If the
// cancel-push reads the record before the create-push has written
// google_event_id back, it has no id to delete and the event is orphaned on
// Google forever — the exact "I cancelled it but it's still on my calendar"
// symptom. Sweeping by the heartfulId tag catches that event regardless of
// what the local record knows about it.
export async function deleteHeartfulEventsByLocalId(
  auth: InstanceType<typeof google.auth.OAuth2>,
  calendarId: string,
  localId: string
): Promise<void> {
  const cal = calendarClient(auth);
  try {
    const res = await cal.events.list({
      calendarId,
      privateExtendedProperty: [`heartfulId=${localId}`],
      showDeleted: false,
      singleEvents: true,
      maxResults: 50,
    });
    for (const event of res.data.items ?? []) {
      if (event.id) await deleteHeartfulEvent(auth, calendarId, event.id);
    }
  } catch (err) {
    console.error(`Failed to sweep Google Calendar events for ${localId}:`, err);
  }
}

export interface ListChangesResult {
  events: calendar_v3.Schema$Event[];
  nextSyncToken?: string;
  resyncRequired: boolean;
}

// Incremental fetch using a stored syncToken. If Google reports the token as
// expired/invalid (410), the caller should treat this as resyncRequired and
// fall back to a bounded full listing.
export async function listChangedEvents(
  auth: InstanceType<typeof google.auth.OAuth2>,
  calendarId: string,
  syncToken?: string
): Promise<ListChangesResult> {
  const cal = calendarClient(auth);
  try {
    if (syncToken) {
      const events: calendar_v3.Schema$Event[] = [];
      let pageToken: string | undefined;
      let nextSyncToken: string | undefined;
      do {
        const res = await cal.events.list({
          calendarId,
          syncToken,
          pageToken,
          showDeleted: true,
          singleEvents: true,
        });
        events.push(...(res.data.items ?? []));
        pageToken = res.data.nextPageToken ?? undefined;
        nextSyncToken = res.data.nextSyncToken ?? nextSyncToken;
      } while (pageToken);
      return { events, nextSyncToken, resyncRequired: false };
    }
    // First-ever sync for this calendar: bound the window so we don't pull
    // a full lifetime of history. This matters a lot in practice — with
    // singleEvents:true, any recurring event (daily/weekly personal
    // reminders, standing appointments, etc.) on a real personal calendar
    // expands into one row per occurrence, and a full year in each
    // direction was regularly large enough to blow past Netlify's
    // synchronous function timeout (504) on the very first sync — which
    // meant it could never save a sync token and make progress, so every
    // subsequent attempt repeated the same oversized listing and timed out
    // again. 90 days back covers recent past-call lookups; 270 days
    // forward comfortably covers anything scheduled in advance.
    const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 270 * 24 * 60 * 60 * 1000).toISOString();
    const events: calendar_v3.Schema$Event[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;
    do {
      const res = await cal.events.list({
        calendarId,
        timeMin,
        timeMax,
        pageToken,
        singleEvents: true,
      });
      events.push(...(res.data.items ?? []));
      pageToken = res.data.nextPageToken ?? undefined;
      nextSyncToken = res.data.nextSyncToken ?? nextSyncToken;
    } while (pageToken);
    return { events, nextSyncToken, resyncRequired: false };
  } catch (err: unknown) {
    const status = (err as { code?: number; response?: { status?: number } })?.code
      ?? (err as { response?: { status?: number } })?.response?.status;
    if (status === 410) {
      return { events: [], resyncRequired: true };
    }
    throw err;
  }
}

// Registers a push-notification (webhook) channel for a calendar so Google
// pings our webhook route within seconds of any change. Channels expire
// (max ~1 month for Calendar, often less) — see the renewal cron in
// netlify/functions/renew-google-watch.mts.
export async function watchCalendar(
  auth: InstanceType<typeof google.auth.OAuth2>,
  calendarId: string,
  channelId: string,
  webhookUrl: string,
  token: string
): Promise<{ resourceId: string; expiration?: number }> {
  const cal = calendarClient(auth);
  const res = await cal.events.watch({
    calendarId,
    requestBody: { id: channelId, type: "web_hook", address: webhookUrl, token },
  });
  return {
    resourceId: res.data.resourceId!,
    expiration: res.data.expiration ? Number(res.data.expiration) : undefined,
  };
}

export async function stopChannel(
  auth: InstanceType<typeof google.auth.OAuth2>,
  channelId: string,
  resourceId: string
): Promise<void> {
  const cal = calendarClient(auth);
  try {
    await cal.channels.stop({ requestBody: { id: channelId, resourceId } });
  } catch (err) {
    // Best-effort — if the channel already expired/was stopped, Google 404s.
    console.error("Failed to stop Google Calendar watch channel:", err);
  }
}
