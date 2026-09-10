import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/googleCalendar";

// Not covered by middleware.ts (which skips /api entirely — see its
// comment), so this route checks the practitioner auth cookie itself before
// sending anyone to Google's consent screen.
async function isPractitionerAuthed(): Promise<boolean> {
  const expected = process.env.PRACTITIONER_PASSWORD;
  if (!expected) return true;
  return (await cookies()).get("heartful_auth")?.value === expected;
}

export async function GET(req: NextRequest) {
  if (!(await isPractitionerAuthed())) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!isGoogleOAuthConfigured) {
    return NextResponse.redirect(new URL("/settings?google=not_configured", req.url));
  }
  return NextResponse.redirect(buildGoogleAuthUrl());
}
