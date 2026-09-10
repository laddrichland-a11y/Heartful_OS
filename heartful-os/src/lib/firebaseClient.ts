// Firebase CLIENT SDK — browser-side only, used for real-time onSnapshot
// subscriptions. All writes still go through server actions (Admin SDK).
//
// Requires these NEXT_PUBLIC_ env vars (safe to expose — they're designed
// to be public; Firestore security rules control what can actually be read):
//
//   NEXT_PUBLIC_FIREBASE_API_KEY
//   NEXT_PUBLIC_FIREBASE_PROJECT_ID
//   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN   (usually <projectId>.firebaseapp.com)
//   NEXT_PUBLIC_FIREBASE_APP_ID
//
// If these vars are absent the hook falls back to server-action polling.

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const AUTH_DOMAIN = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const APP_ID = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

export const isClientFirebaseConfigured = !!(API_KEY && PROJECT_ID);

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;

export function getClientDb(): Firestore | null {
  if (!isClientFirebaseConfigured) return null;
  if (_db) return _db;
  _app = getApps().length > 0
    ? getApps()[0]
    : initializeApp({ apiKey: API_KEY, projectId: PROJECT_ID, authDomain: AUTH_DOMAIN, appId: APP_ID });
  _db = getFirestore(_app);
  return _db;
}
