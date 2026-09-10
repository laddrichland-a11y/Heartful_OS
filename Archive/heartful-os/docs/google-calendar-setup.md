# Google Calendar Sync — Setup

Heartful OS can sync Sessions and Prospect Calls two-ways with your Google Calendar. This only needs to be set up once. It requires creating a free OAuth client in Google Cloud Console — takes about 10 minutes.

## What this actually does

- Creates a new calendar in your Google account called **"Heartful OS"**. Every Session and Prospect Call scheduled in the app is mirrored there as an event.
- Watches your **primary** Google Calendar read-only, purely to know when you're busy — anything on it shows up in Heartful OS as a "Busy" block and is checked for conflicts when you schedule something new. Nothing is ever written to your primary calendar.
- Syncs both ways, near real-time: reschedule or cancel a session in Heartful OS and it updates on Google within seconds; move or delete the mirrored event directly in Google Calendar and it updates back in Heartful OS the same way.
- A daily background job keeps the sync connection alive so it doesn't quietly go stale.

## 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in with the Google account whose calendar you want to sync (your own).
2. Click the project dropdown at the top → **New Project**. Name it something like "Heartful OS" → **Create**.
3. Make sure the new project is selected in the dropdown before continuing.

## 2. Enable the Calendar API

1. In the left sidebar, go to **APIs & Services → Library**.
2. Search for "Google Calendar API" → open it → **Enable**.

## 3. Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. User type: **External** (this is fine for personal use — Google will show an "unverified app" warning when you connect, which is expected and safe to click through since you're the only user).
3. Fill in the required fields (app name "Heartful OS", your email for support/developer contact).
4. Under **Scopes**, add: `https://www.googleapis.com/auth/calendar`.
5. Under **Test users**, add your own Google account email.
6. Save through the remaining steps. You can leave the app in "Testing" status — no need to submit for verification.

## 4. Create OAuth credentials

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Under **Authorized redirect URIs**, add:
   ```
   https://<your-site-domain>/api/integrations/google/callback
   ```
   Replace `<your-site-domain>` with your actual Netlify site URL (e.g. `heartful-os.netlify.app`, or your custom domain if you have one). For local testing, also add `http://localhost:3000/api/integrations/google/callback`.
4. Click **Create**. Copy the **Client ID** and **Client Secret** shown — you'll need them next.

## 5. Set environment variables

Add these wherever you set the app's other environment variables (Netlify: **Site configuration → Environment variables**; locally: `.env.local`):

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | from step 4 |
| `GOOGLE_CLIENT_SECRET` | from step 4 |
| `GOOGLE_REDIRECT_URI` | `https://<your-site-domain>/api/integrations/google/callback` (must exactly match what you entered in step 4) |
| `SITE_URL` | `https://<your-site-domain>` (no trailing slash) |
| `CRON_SECRET` | any random string you make up (e.g. generate one with `openssl rand -hex 32`) |

`CRON_SECRET` just needs to exist and match — it's what stops a stranger from hitting the daily renewal endpoint. Netlify's scheduled function (`netlify/functions/renew-google-watch.mts`) automatically has access to the same site-wide environment variables, so you don't need to configure it separately.

## 6. Deploy, then connect

1. Deploy the site (or restart your local dev server) so the new environment variables take effect.
2. In Heartful OS, go to **Settings** → **Google Calendar Sync** → **Connect Google Calendar**.
3. Google will show a consent screen (with an "unverified app" warning — click **Advanced → Go to Heartful OS (unsafe)**, this is expected for a personal-use app you own). Approve calendar access.
4. You'll land back on Settings with "Google Calendar connected." The "Heartful OS" calendar is created automatically and an initial sync runs right away.

## Troubleshooting

- **"Couldn't connect: ..." on Settings** — usually means `GOOGLE_REDIRECT_URI` doesn't exactly match an Authorized redirect URI on the OAuth client (check for a trailing slash or http vs https mismatch).
- **Sync seems stuck** — click **Sync now** on the Settings page to force an immediate pull, or check "Last sync error" shown there.
- **Push notifications stop working after a while** — the daily renewal job (`netlify/functions/renew-google-watch.mts`) handles this automatically; check the function's logs in Netlify if syncing seems to lag consistently.
