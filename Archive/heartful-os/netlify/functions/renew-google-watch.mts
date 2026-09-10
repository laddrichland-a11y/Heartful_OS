// Netlify Scheduled Function — runs once a day and hits the Next.js API
// route that renews the Google Calendar push-notification (webhook)
// channels before they expire. Kept as a thin HTTP call (rather than
// importing the sync code directly) so this function stays tiny and doesn't
// need its own copy of the Firebase/Google credentials wiring — it just
// rides on the already-deployed Next.js app's own route.
//
// Netlify config: runs daily at 03:00 UTC. Requires SITE_URL and
// CRON_SECRET to be set as environment variables on the site (the same
// CRON_SECRET must also be set for the Next.js app itself — see
// src/app/api/integrations/google/renew/route.ts).

const renewGoogleWatch = async () => {
  const siteUrl = process.env.SITE_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!siteUrl) {
    console.error("renew-google-watch: SITE_URL is not set, skipping.");
    return new Response("SITE_URL not set", { status: 500 });
  }

  try {
    const res = await fetch(`${siteUrl.replace(/\/$/, "")}/api/integrations/google/renew`, {
      method: "POST",
      headers: cronSecret ? { "x-cron-secret": cronSecret } : {},
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`renew-google-watch: renew endpoint returned ${res.status}: ${body}`);
      return new Response(body, { status: res.status });
    }
    console.log("renew-google-watch: channels renewed OK", body);
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("renew-google-watch: failed to call renew endpoint:", err);
    return new Response(String(err), { status: 500 });
  }
};

export default renewGoogleWatch;

export const config = {
  schedule: "0 3 * * *",
};
