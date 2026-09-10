import { NextRequest, NextResponse } from "next/server";
import * as data from "@/lib/data";
import { pullAndApplyChanges } from "@/lib/googleCalendarSync";

// Google's push notifications for the Calendar API carry no event body —
// just headers (X-Goog-Channel-Id, X-Goog-Resource-State, etc.) telling us
// "something changed on this channel, go fetch it yourself." We verify the
// request is really from Google via X-Goog-Channel-Token (the shared secret
// we supplied when registering the channel — see renewWatchChannels), then
// run an incremental pull using the stored syncToken.
//
// Not covered by middleware.ts's practitioner-cookie gate (deliberately —
// Google's servers can't carry that cookie), so the channel token is the
// only thing standing in for auth here.
export async function POST(req: NextRequest) {
  const incomingToken = req.headers.get("x-goog-channel-token");
  const state = req.headers.get("x-goog-resource-state");

  const settings = await data.getGoogleCalendarSettings();
  if (!settings.webhook_token || incomingToken !== settings.webhook_token) {
    return NextResponse.json({ error: "invalid channel token" }, { status: 403 });
  }

  // "sync" is the initial confirmation ping when a channel is first created —
  // nothing changed yet, just acknowledge it.
  if (state === "sync") {
    return NextResponse.json({ ok: true });
  }

  try {
    await pullAndApplyChanges();
  } catch (err) {
    // Google retries webhook deliveries on failure, but a sync bug shouldn't
    // hold up the response — log and still 200 so it doesn't hammer retries.
    console.error("Google Calendar webhook sync failed:", err);
  }

  return NextResponse.json({ ok: true });
}
