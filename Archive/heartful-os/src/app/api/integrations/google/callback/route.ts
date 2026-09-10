import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeAndSaveTokens, ensureHeartfulCalendar } from "@/lib/googleCalendar";
import { renewWatchChannels, pullAndApplyChanges } from "@/lib/googleCalendarSync";

async function isPractitionerAuthed(): Promise<boolean> {
  const expected = process.env.PRACTITIONER_PASSWORD;
  if (!expected) return true;
  return (await cookies()).get("heartful_auth")?.value === expected;
}

export async function GET(req: NextRequest) {
  if (!(await isPractitionerAuthed())) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = req.nextUrl;
  const error = searchParams.get("error");
  const code = searchParams.get("code");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?google=error&reason=${encodeURIComponent(error)}`, req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/settings?google=error&reason=missing_code", req.url));
  }

  try {
    const client = await exchangeCodeAndSaveTokens(code);
    await ensureHeartfulCalendar(client);
    // Register webhook channels and pull a baseline sync right away so the
    // Calendar page has data immediately instead of waiting for the first
    // push notification.
    await renewWatchChannels({ force: true });
    await pullAndApplyChanges();
    return NextResponse.redirect(new URL("/settings?google=connected", req.url));
  } catch (err) {
    console.error("Google Calendar connect failed:", err);
    const reason = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(new URL(`/settings?google=error&reason=${encodeURIComponent(reason)}`, req.url));
  }
}
