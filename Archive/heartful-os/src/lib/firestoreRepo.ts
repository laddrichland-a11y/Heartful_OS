import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebaseAdmin";

// ---------------------------------------------------------------------------
// Thin generic helpers over Firestore collections, used by data.ts. Every
// document is stored with its own `id` field used as the Firestore document
// ID too, so these helpers stay simple find/insert/update primitives that
// mirror the shape the old in-memory mock store used (array of objects with
// an `id`), keeping the rewrite of data.ts mechanical.
//
// Collections in this app are small (a single practitioner's client list),
// so reading a whole collection per call is simpler and plenty fast — no
// composite indexes to manage, no risk of stale cached reads across
// serverless function instances.
// ---------------------------------------------------------------------------

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("Firestore is not configured (missing FIREBASE_* env vars)");
  return db;
}

// Firestore's `.set()` throws on any field whose value is `undefined`
// (unlike a plain JS object, which just omits it) — including nested inside
// objects and arrays (e.g. an optional `notes` field on a document version
// record buried inside `versions: [...]`). Our callers build objects the
// old mock-store way — e.g. `email: input.email` where `input.email` may
// explicitly be `undefined` for "not provided" — so every write path needs
// this same scrub, recursively, not just updates.
function deepStripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => deepStripUndefined(v));
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) clean[k] = deepStripUndefined(v);
    }
    return clean;
  }
  return value;
}

function stripUndefined<T>(obj: T): Record<string, unknown> {
  return deepStripUndefined(obj) as Record<string, unknown>;
}

export async function allDocs<T>(collection: string): Promise<T[]> {
  const snap = await requireDb().collection(collection).get();
  return snap.docs.map((d) => d.data() as T);
}

// Firestore's `.doc(id)` throws synchronously on an empty string ("Value
// for argument 'documentPath' is not a valid resource path"). Callers reach
// here with a blank id whenever a page renders for a record that doesn't
// exist yet (e.g. a Journey Day page for a client with no Journey Day
// session on the calendar), so treat blank as "not found" instead of
// letting it blow up the server action.
export async function getDocById<T>(collection: string, id: string): Promise<T | undefined> {
  if (!id) return undefined;
  const snap = await requireDb().collection(collection).doc(id).get();
  return snap.exists ? (snap.data() as T) : undefined;
}

export async function insertDoc<T extends { id: string }>(collection: string, doc: T): Promise<T> {
  await requireDb().collection(collection).doc(doc.id).set(stripUndefined(doc));
  return doc;
}

export async function insertDocs<T extends { id: string }>(collection: string, docs: T[]): Promise<T[]> {
  if (docs.length === 0) return docs;
  const batch = requireDb().batch();
  for (const doc of docs) {
    batch.set(requireDb().collection(collection).doc(doc.id), stripUndefined(doc));
  }
  await batch.commit();
  return docs;
}

export async function updateDocById<T>(
  collection: string,
  id: string,
  patch: Partial<T>
): Promise<T | undefined> {
  if (!id) return undefined;
  const ref = requireDb().collection(collection).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return undefined;
  await ref.set(stripUndefined(patch), { merge: true });
  const updated = await ref.get();
  return updated.data() as T;
}

// Removes fields from a document outright.
//
// updateDocById can't do this: it runs every patch through stripUndefined, so
// `{ field: undefined }` is dropped from the write rather than clearing the
// field — the patch is a no-op and the old value survives. That's the right
// default (callers routinely pass optional fields as undefined meaning "leave
// it alone"), so clearing needs its own explicit primitive.
export async function clearDocFields(collection: string, id: string, fields: string[]): Promise<void> {
  if (!id || fields.length === 0) return;
  const ref = requireDb().collection(collection).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  const patch: Record<string, unknown> = {};
  for (const f of fields) patch[f] = FieldValue.delete();
  await ref.update(patch);
}

export async function queryEq<T>(collection: string, field: string, value: unknown): Promise<T[]> {
  const snap = await requireDb().collection(collection).where(field, "==", value).get();
  return snap.docs.map((d) => d.data() as T);
}

export async function deleteDoc(collection: string, id: string): Promise<void> {
  await requireDb().collection(collection).doc(id).delete();
}

export async function deleteDocsWhere(collection: string, field: string, value: unknown): Promise<void> {
  const snap = await requireDb().collection(collection).where(field, "==", value).get();
  if (snap.empty) return;
  const batch = requireDb().batch();
  for (const doc of snap.docs) batch.delete(doc.ref);
  await batch.commit();
}

export async function getSingleton<T>(collection: string, id: string): Promise<T | undefined> {
  return getDocById<T>(collection, id);
}

export async function setSingleton<T extends Record<string, unknown>>(
  collection: string,
  id: string,
  data: T
): Promise<T> {
  await requireDb().collection(collection).doc(id).set(stripUndefined(data), { merge: true });
  return data;
}
