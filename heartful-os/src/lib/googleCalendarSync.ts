import { randomUUID } from "crypto";
import { calendar_v3 } from "googleapis";
import * as data from "@/lib/data";
import { occupiesCalendarSlot, SESSION_TYPE_LABELS } from "@/lib/utils";
import {
  getAuthorizedClient,
  ensureHeartfulCalendar,
  upsertHeartfulEvent,
  deleteHeartfulEvent,
  deleteHeartfulEventsByLocalId,
  listChangedEvents,
  watchCalendar,
  stopChannel,
  PRIMARY_CALENDAR_ID,
} from "@/lib/googleCalendar";

// ---------------------------------------------------------------------------
// Two-way sync logic. "Push" runs synchronously from a server action right
// after a local write (fire-and-forget — callers don't await the network
// round trip, see actions.ts) so the UI never blocks on Google. "Pull" runs
// from the webhook route (near-real-time) and is also safe to call from a
// cron/manual "sync now" button as a fallback.
//
// Loop prevention: every push stamps the local record's google_synced_at.
// When we later see that same event come back through an incremental pull,
// we compare Google's `updated` timestamp to google_synced_at — if they're
// within a few seconds of each other, it's almost certainly the echo of our
// own write, not an independent edit made directly in Google Calendar, so we
// skip re-applying it.
// ---------------------------------------------------------------------------

const ECHO_WINDOW_MS = 20_000;

function isEcho(googleUpdatedIso: string | null | undefined, localSyncedAtIso: string | null | undefined): boolean {
  if (!googleUpdatedIso || !localSyncedAtIso) return false;
  const diff = Math.abs(new Date(googleUpdatedIso).getTime() - new Date(localSyncedAtIso).getTime());
  return diff < ECHO_WINDOW_MS;
}

// ---------------------------------------------------------------------------
// PUSH — mirror a local Session or ProspectCall to the "Heartful OS" Google
// calendar. Best-effort: any failure is logged, never thrown, so a Google
// hiccup never breaks scheduling inside the app.
// ---------------------------------------------------------------------------

export async function pushSessionToGoogle(sessionId: string): Promise<void> {
  try {
    const auth = await getAuthorizedClient();
    if (!auth) return;
    const session = await data.getSession(sessionId);
    if (!session) return;

    const calendarId = await ensureHeartfulCalendar(auth);

    // Cancelled, or no longer has a time: it holds no slot, so it must not
    // exist on Google. Sweeping by tag (not just by the stored event id)
    // covers the case where the create-push hadn't yet written
    // google_event_id back when the cancel came through.
    if (!occupiesCalendarSlot(session)) {
      await removeSessionFromGoogle(auth, calendarId, session);
      return;
    }

    const client = await data.getClient(session.client_id);
    const title = `${client?.full_name ?? "Client"} — ${SESSION_TYPE_LABELS[session.session_type] ?? session.session_type.replace(/_/g, " ")}`;

    const event = await upsertHeartfulEvent(
      auth,
      calendarId,
      {
        title,
        description: session.location,
        startIso: session.scheduled_at,
        durationMinutes: session.duration_minutes ?? 60,
        kind: "session",
        localId: session.id,
      },
      session.google_event_id
    );

    await data.updateSession(sessionId, {
      google_event_id: event.id ?? undefined,
      google_synced_at: new Date().toISOString(),
    });

    // The record can be cancelled *while* we're talking to Google (the
    // pushes are fire-and-forget and can interleave). Re-read and undo our
    // own write if that happened, so a cancel can never lose the race and
    // leave the event standing.
    const after = await data.getSession(sessionId);
    if (after && !occupiesCalendarSlot(after)) {
      await removeSessionFromGoogle(auth, calendarId, after);
    }
  } catch (err) {
    console.error(`Failed to push session ${sessionId} to Google Calendar:`, err);
  }
}

async function removeSessionFromGoogle(
  auth: NonNullable<Awaited<ReturnType<typeof getAuthorizedClient>>>,
  calendarId: string,
  session: { id: string; google_event_id?: string }
): Promise<void> {
  if (session.google_event_id) {
    await deleteHeartfulEvent(auth, calendarId, session.google_event_id);
  }
  await deleteHeartfulEventsByLocalId(auth, calendarId, session.id);
  await data.clearSessionGoogleEvent(session.id);
}

export async function pushProspectCallToGoogle(callId: string): Promise<void> {
  try {
    const auth = await getAuthorizedClient();
    if (!auth) return;
    const calls = await data.getAllProspectCalls();
    const call = calls.find((c) => c.id === callId);
    if (!call) return;

    const calendarId = await ensureHeartfulCalendar(auth);

    // Same rule as sessions — see occupiesCalendarSlot and the sweep comment
    // in removeSessionFromGoogle above.
    if (!occupiesCalendarSlot(call)) {
      await removeProspectCallFromGoogle(auth, calendarId, call);
      return;
    }

    // Hold reminders can belong to a client rather than a prospect, so don't
    // blanket-label these "(Prospect)" — the suffix should match the record
    // the reminder actually points at.
    const callLabel =
      call.call_type === "intro_call"
        ? "Intro Call"
        : call.call_type === "hold_follow_up"
          ? "On-Hold Follow-Up"
          : "Follow-up Call";
    const ownerLabel = call.client_id ? "Client" : "Prospect";
    const title = `${call.prospect_name} — ${callLabel} (${ownerLabel})`;

    const event = await upsertHeartfulEvent(
      auth,
      calendarId,
      {
        title,
        description: call.notes,
        startIso: call.scheduled_at,
        durationMinutes: call.duration_minutes ?? 30,
        kind: "prospect_call",
        localId: call.id,
      },
      call.google_event_id
    );

    await data.updateProspectCall(callId, {
      google_event_id: event.id ?? undefined,
      google_synced_at: new Date().toISOString(),
    });

    const afterCalls = await data.getAllProspectCalls();
    const after = afterCalls.find((c) => c.id === callId);
    if (after && !occupiesCalendarSlot(after)) {
      await removeProspectCallFromGoogle(auth, calendarId, after);
    }
  } catch (err) {
    console.error(`Failed to push prospect call ${callId} to Google Calendar:`, err);
  }
}

async function removeProspectCallFromGoogle(
  auth: NonNullable<Awaited<ReturnType<typeof getAuthorizedClient>>>,
  calendarId: string,
  call: { id: string; google_event_id?: string }
): Promise<void> {
  if (call.google_event_id) {
    await deleteHeartfulEvent(auth, calendarId, call.google_event_id);
  }
  await deleteHeartfulEventsByLocalId(auth, calendarId, call.id);
  await data.clearProspectCallGoogleEvent(call.id);
}

// ---------------------------------------------------------------------------
// PULL — apply changes from Google (either calendar) back into Heartful OS.
// Called from the webhook route on every push notification, and can also be
// invoked manually as a fallback ("Sync now" in Settings).
// ---------------------------------------------------------------------------

export async function pullAndApplyChanges(): Promise<void> {
  const auth = await getAuthorizedClient();
  if (!auth) return;

  const settings = await data.getGoogleCalendarSettings();
  const calendarId = await ensureHeartfulCalendar(auth);

  // Run both calendars concurrently rather than sequentially — halves the
  // wall-clock time of a sync, which matters a lot for staying under
  // Netlify's synchronous function timeout (this was previously the two
  // biggest contributors to a 504 on "Sync now"/the webhook route, along
  // with the unbounded first-sync window fixed in listChangedEvents).
  await Promise.all([
    syncOneCalendar(auth, calendarId, "heartful", settings.heartful_sync_token),
    syncOneCalendar(auth, PRIMARY_CALENDAR_ID, "primary", settings.primary_sync_token),
  ]);

  await data.saveGoogleCalendarSettings({ last_synced_at: new Date().toISOString(), last_sync_error: undefined });
}

async function syncOneCalendar(
  auth: Awaited<ReturnType<typeof getAuthorizedClient>>,
  calendarId: string,
  which: "heartful" | "primary",
  storedSyncToken: string | undefined
): Promise<void> {
  if (!auth) return;
  try {
    let result = await listChangedEvents(auth, calendarId, storedSyncToken);
    if (result.resyncRequired) {
      // Token expired/invalid — drop it and do a bounded full listing instead.
      result = await listChangedEvents(auth, calendarId, undefined);
    }

    for (const event of result.events) {
      if (which === "heartful") {
        await applyHeartfulCalendarEvent(event);
      } else {
        await applyPrimaryCalendarEvent(event);
      }
    }

    if (result.nextSyncToken) {
      await data.saveGoogleCalendarSettings(
        which === "heartful"
          ? { heartful_sync_token: result.nextSyncToken }
          : { primary_sync_token: result.nextSyncToken }
      );
    }
  } catch (err) {
    console.error(`Google Calendar pull sync failed for ${which} calendar:`, err);
    await data.saveGoogleCalendarSettings({
      last_sync_error: err instanceof Error ? err.message : String(err),
    });
  }
}

// Events on the "Heartful OS" calendar. Ones we created ourselves carry an
// extendedProperties.private.heartfulId tag — for those we only care about
// changes NOT made by us (i.e. the practitioner rescheduled/deleted the
// mirrored event directly in Google). Untagged events were created directly
// on that calendar by the practitioner and are mirrored in as busy blocks.
async function applyHeartfulCalendarEvent(event: calendar_v3.Schema$Event): Promise<void> {
  const heartfulId = event.extendedProperties?.private?.heartfulId;
  const kind = event.extendedProperties?.private?.heartfulKind as "session" | "prospect_call" | undefined;

  if (heartfulId && kind) {
    if (kind === "session") {
      const session = await data.getSession(heartfulId);
      if (!session) return;
      if (isEcho(event.updated, session.google_synced_at)) return;

      if (event.status === "cancelled") {
        if (session.status !== "cancelled") await data.updateSession(heartfulId, { status: "cancelled" });
        return;
      }
      const start = event.start?.dateTime ?? event.start?.date;
      if (!start) return;
      const end = event.end?.dateTime ?? event.end?.date;
      const durationMinutes = end ? Math.max(5, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)) : session.duration_minutes;
      await data.updateSession(heartfulId, {
        scheduled_at: new Date(start).toISOString(),
        duration_minutes: durationMinutes,
      });
    } else {
      const calls = await data.getAllProspectCalls();
      const call = calls.find((c) => c.id === heartfulId);
      if (!call) return;
      if (isEcho(event.updated, call.google_synced_at)) return;

      if (event.status === "cancelled") {
        if (call.status !== "cancelled") await data.updateProspectCall(heartfulId, { status: "cancelled" });
        return;
      }
      const start = event.start?.dateTime ?? event.start?.date;
      if (!start) return;
      const end = event.end?.dateTime ?? event.end?.date;
      const durationMinutes = end ? Math.max(5, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)) : call.duration_minutes;
      await data.updateProspectCall(heartfulId, {
        scheduled_at: new Date(start).toISOString(),
        duration_minutes: durationMinutes,
      });
    }
    return;
  }

  // Untagged — created directly on the Heartful OS calendar in Google.
  await mirrorAsExternalEvent(event);
}

// Everything on the primary calendar is treated as an opaque "busy" block —
// we never created events there, so no echo-suppression is needed.
async function applyPrimaryCalendarEvent(event: calendar_v3.Schema$Event): Promise<void> {
  await mirrorAsExternalEvent(event);
}

// ---------------------------------------------------------------------------
// WATCH CHANNEL RENEWAL — Google push-notification channels expire (Calendar
// caps them well under a year, in practice often ~1 week to a month), so a
// scheduled job needs to re-register them before that happens or the
// near-real-time webhook sync silently goes stale. Called by the daily
// Netlify scheduled function; also runs once right after connecting.
// ---------------------------------------------------------------------------

const RENEW_IF_EXPIRING_WITHIN_MS = 24 * 60 * 60 * 1000; // 1 day

export async function renewWatchChannels(opts: { force?: boolean } = {}): Promise<void> {
  const auth = await getAuthorizedClient();
  if (!auth) return;

  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) {
    console.error("Cannot renew Google Calendar watch channels — SITE_URL is not set.");
    return;
  }
  const webhookUrl = `${siteUrl.replace(/\/$/, "")}/api/integrations/google/webhook`;

  let settings = await data.getGoogleCalendarSettings();
  if (!settings.webhook_token) {
    settings = await data.saveGoogleCalendarSettings({ webhook_token: randomUUID() });
  }
  const token = settings.webhook_token!;
  const calendarId = await ensureHeartfulCalendar(auth);

  await renewOne(auth, calendarId, "heartful", webhookUrl, token, opts.force);
  await renewOne(auth, PRIMARY_CALENDAR_ID, "primary", webhookUrl, token, opts.force);
}

async function renewOne(
  auth: Awaited<ReturnType<typeof getAuthorizedClient>>,
  calendarId: string,
  which: "heartful" | "primary",
  webhookUrl: string,
  token: string,
  force?: boolean
): Promise<void> {
  if (!auth) return;
  const settings = await data.getGoogleCalendarSettings();
  const expiration = which === "heartful" ? settings.heartful_channel_expiration : settings.primary_channel_expiration;
  const stillFresh = expiration && expiration - Date.now() > RENEW_IF_EXPIRING_WITHIN_MS;
  if (stillFresh && !force) return;

  const oldChannelId = which === "heartful" ? settings.heartful_channel_id : settings.primary_channel_id;
  const oldResourceId = which === "heartful" ? settings.heartful_channel_resource_id : settings.primary_channel_resource_id;
  if (oldChannelId && oldResourceId) {
    await stopChannel(auth, oldChannelId, oldResourceId);
  }

  try {
    const channelId = randomUUID();
    const { resourceId, expiration: newExpiration } = await watchCalendar(auth, calendarId, channelId, webhookUrl, token);
    await data.saveGoogleCalendarSettings(
      which === "heartful"
        ? { heartful_channel_id: channelId, heartful_channel_resource_id: resourceId, heartful_channel_expiration: newExpiration }
        : { primary_channel_id: channelId, primary_channel_resource_id: resourceId, primary_channel_expiration: newExpiration }
    );
  } catch (err) {
    console.error(`Failed to register Google Calendar watch channel for ${which} calendar:`, err);
  }
}

async function mirrorAsExternalEvent(event: calendar_v3.Schema$Event): Promise<void> {
  if (!event.id) return;
  if (event.status === "cancelled") {
    await data.deleteExternalCalendarEventByGoogleId(event.id);
    return;
  }
  const start = event.start?.dateTime ?? event.start?.date;
  if (!start) return;
  const end = event.end?.dateTime ?? event.end?.date;
  await data.upsertExternalCalendarEvent({
    google_event_id: event.id,
    title: event.summary || "Busy",
    start_at: new Date(start).toISOString(),
    end_at: end ? new Date(end).toISOString() : undefined,
    all_day: Boolean(event.start?.date && !event.start?.dateTime),
    status: "confirmed",
    updated_at: event.updated ?? new Date().toISOString(),
  });
}
