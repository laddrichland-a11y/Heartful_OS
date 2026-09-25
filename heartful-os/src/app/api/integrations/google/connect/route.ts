import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/googleCalendar";
import { requirePractitioner } from "@/lib/serverAuth";

// Not covered by middleware.ts (which skips /api entirely — see its
// comment), so this route checks the practitioner auth cookie itself before
// sending anyone to Google's consent screen.
export async function GET(req: NextRequest) {
  try {
    await requirePractitioner();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!isGoogleOAuthConfigured) {
    return NextResponse.redirect(new URL("/settings?google=not_configured", req.url));
  }
  return NextResponse.redirect(buildGoogleAuthUrl());
}
