"use client";

// Real-time form synchronisation hook.
//
// When NEXT_PUBLIC_FIREBASE_* vars are present it uses Firestore onSnapshot
// (sub-100 ms updates). Otherwise it falls back to polling `fallbackPoll`
// every 700 ms — still fast enough to feel responsive without any extra setup.

import { useEffect, useRef } from "react";
import { FormSubmission } from "@/lib/types";
import { getClientDb } from "@/lib/firebaseClient";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export function useFormSync(
  documentId: string,
  active: boolean,
  onUpdate: (sub: FormSubmission) => void,
  fallbackPoll: (() => Promise<FormSubmission | undefined>) | undefined
) {
  // Keep a stable ref to the callback so the effect doesn't re-subscribe
  // every render when onUpdate is an inline function.
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; });

  const fallbackRef = useRef(fallbackPoll);
  useEffect(() => { fallbackRef.current = fallbackPoll; });

  useEffect(() => {
    if (!active) return;

    const db = getClientDb();

    if (db) {
      // ── True real-time: Firestore onSnapshot ──────────────────────────────
      // formSubmissions are keyed by their own `id` in Firestore but we only
      // know the parent document_id here, so we do a collection query.
      // Requires Firestore rules: allow read on formSubmissions.
      const q = query(
        collection(db, "formSubmissions"),
        where("document_id", "==", documentId)
      );
      const unsub = onSnapshot(q, (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
        const snap = snapshot.docs[0];
        if (!snap) return;
        const incoming = { id: snap.id, ...snap.data() } as FormSubmission;
        // Merge: only accept fields not currently dirty locally
        onUpdateRef.current(incoming);
      });
      return () => unsub();
    }

    if (fallbackRef.current) {
      // ── Fallback: fast polling ────────────────────────────────────────────
      const POLL_MS = 700;
      const interval = setInterval(async () => {
        const latest = await fallbackRef.current?.();
        if (latest) onUpdateRef.current(latest);
      }, POLL_MS);
      return () => clearInterval(interval);
    }
  }, [documentId, active]);
}
