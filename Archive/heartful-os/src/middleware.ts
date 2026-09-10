import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Lightweight practitioner-side gate. This protects every route except the
// real client portal entry point (/portal?client=<id>, which has its own
// email+password login check inside the server action that loads the data —
// see getPortalBundleAction in actions.ts) and the login page itself.
//
// The auth cookie's value is the practitioner password itself (set only by
// the /login server action after checking it server-side). That's a
// deliberately simple, single-secret model — there's one practitioner and
// no account system, so the password *is* the session secret. Edge
// middleware can't reach Firestore/the mock store, so this has to be
// something comparable without a database round trip.
// ---------------------------------------------------------------------------

const AUTH_COOKIE = "heartful_auth";
// Remembers which client a device belongs to, so a bare /portal or / visit
// can be turned back into that client's deep link. See the two blocks that
// use it in middleware() below.
const PORTAL_CLIENT_COOKIE = "heartful_portal_client";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const PUBLIC_PATHS = ["/login", "/favicon.ico"];

function isPractitionerAuthed(req: NextRequest): boolean {
  const expected = process.env.PRACTITIONER_PASSWORD;
  if (!expected) return true; // no password configured — don't lock the owner out
  return req.cookies.get(AUTH_COOKIE)?.value === expected;
}

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    // icon.tsx/apple-icon.tsx (Next's file-convention icon routes) are
    // served at /icon and /apple-icon with no file extension, so they
    // weren't caught by the extension regex below — meaning iOS "Add to
    // Home Screen" (which fetches apple-touch-icon unauthenticated) and any
    // client viewing the portal without a practitioner session would get
    // redirected to /login instead of the actual icon image.
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon") ||
    /\.(svg|png|jpg|jpeg|ico|webmanifest)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // The real client deep link (/portal?client=<id>) is the one path real
  // clients use without ever logging in as the practitioner — it's gated by
  // its own email+password login check server-side instead. Visiting bare /portal (the
  // in-app demo client-picker, used for practitioner preview) still requires
  // practitioner auth, same as every other page.
  const deepLinkClientId = pathname === "/portal" ? searchParams.get("client") : null;
  if (deepLinkClientId) {
    // Remember the client id. The query string is the only place it lives,
    // and it gets dropped every time the client opens the app from their iOS
    // home screen (a manifest start_url can't carry a per-client query) or
    // navigates to a bare /portal URL. Rebuilding it here, server-side and
    // before any React runs, is what keeps that recovery from racing
    // RoleContext's localStorage hydration the way the old client-side
    // guards did.
    //
    // httpOnly is safe: the app reads the id from the URL, never from JS.
    // The cookie grants nothing on its own — portal_unlock_<id>, set only
    // after an email+password check, is still what unlocks the data.
    const res = NextResponse.next();
    res.cookies.set(PORTAL_CLIENT_COOKIE, deepLinkClientId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
    });
    return res;
  }

  if (isPractitionerAuthed(req)) return NextResponse.next();

  // Past this point the visitor has no practitioner session. If they've used
  // a deep link on this device before, they're a client who lost their query
  // string — send them back to their own portal rather than to /login, a
  // password screen they can never satisfy. Practitioner auth is checked
  // first above, so this never hijacks the in-app demo picker at bare
  // /portal.
  const rememberedClientId = req.cookies.get(PORTAL_CLIENT_COOKIE)?.value;
  if (rememberedClientId && (pathname === "/portal" || pathname === "/")) {
    const portalUrl = new URL("/portal", req.url);
    portalUrl.searchParams.set("client", rememberedClientId);
    return NextResponse.redirect(portalUrl);
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
