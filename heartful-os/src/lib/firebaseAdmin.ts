import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// ---------------------------------------------------------------------------
// Firebase Admin SDK (server-side only). Backs the real, persistent data
// layer in src/lib/data.ts. If the FIREBASE_* env vars aren't set (e.g. a
// fresh local checkout with no credentials yet), `db` is null and data.ts
// falls back to the in-memory mock store instead of crashing.
// ---------------------------------------------------------------------------

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// Stored in .env.local with literal "\n" sequences (env files can't hold
// real newlines) — unescape them back into actual newlines for the PEM key.
// Also strips any stray surrounding quote characters that some env parsers
// leave in when the value was wrapped in quotes in the .env file.
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ?.replace(/\\n/g, "\n")
  .replace(/^["']|["']$/g, "");

export const isFirebaseConfigured = Boolean(projectId && clientEmail && privateKey);

function getAdminApp(): App | undefined {
  if (!isFirebaseConfigured) return undefined;
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// Lazy getter — called at request time, not at module import time.
// This prevents Next.js from trying to parse the private key during
// `next build` (which fails under OpenSSL 3 on some machines).
export function getDb(): Firestore | null {
  const app = getAdminApp();
  return app ? getFirestore(app) : null;
}

// Cloud Storage (for uploaded session recordings). Reuses the same
// NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET value the client SDK config already
// documents (see firebaseClient.ts) — safe to read server-side too, it's
// just a bucket name, not a credential. A dedicated FIREBASE_STORAGE_BUCKET
// var (server-only) overrides it if set.
const storageBucketName =
  process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

export const isStorageConfigured = Boolean(isFirebaseConfigured && storageBucketName);

// Lazy getter, same reasoning as getDb() above — returns null if either
// Firestore credentials or the bucket name aren't configured, so callers
// can degrade gracefully (e.g. hide the upload button, show a setup hint)
// instead of crashing.
export function getBucket() {
  const app = getAdminApp();
  if (!app || !storageBucketName) return null;
  return getStorage(app).bucket(storageBucketName);
}
