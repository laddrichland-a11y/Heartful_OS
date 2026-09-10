import { NextRequest, NextResponse } from "next/server";
import { renewWatchChannels } from "@/lib/googleCalendarSync";

// Hit by the daily Netlify scheduled function (see
// netlify/functions/renew-google-watch.mts) to keep push-notification
// channels alive before they expire. Guarded by a shared secret since it
// runs unattended, with no practitioner browser session involved.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await renewWatchChannels();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Scheduled Google Calendar channel renewal failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
