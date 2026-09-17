"use client";

import Link from "next/link";
import { Search, X } from "@/components/ui/HeartfulIcon";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/utils";

interface SearchResult {
  type: string;
  clientId: string;
  clientName: string;
  snippet: string;
  href: string;
}

const TYPE_COLORS: Record<string, string> = {
  client: "bg-ink-100 text-ink-600",
  transcript: "bg-plum-100 text-plum-700",
  session_note: "bg-clay-100 text-clay-700",
  theme: "bg-sage-100 text-sage-700",
  intention: "bg-sage-100 text-sage-700",
  action_item: "bg-clay-100 text-clay-700",
  insight: "bg-plum-100 text-plum-700",
};

export default function GlobalSearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, input, a[href]'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        setResults(data.results);
        setError(false);
      } catch (cause) {
        if (controller.signal.aborted) return;
        console.error(cause);
        setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function updateQuery(value: string) {
    setQuery(value);
    setResults([]);
    setError(false);
    setLoading(Boolean(value.trim()));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[min(12vh,7rem)]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" onMouseDown={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Global search" className="relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-4">
          <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-400" />
          <input ref={inputRef} type="search" value={query} onChange={(event) => updateQuery(event.target.value)} aria-label="Search all records" placeholder="Search clients, transcripts, session notes, themes..." className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-400" />
          <button type="button" onClick={onClose} aria-label="Close search" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto p-4" aria-live="polite">
          {!query.trim() && <p className="px-2 py-4 text-sm text-ink-400">Search across clients, transcripts, session notes, themes, intentions, action items, and insights.</p>}
          {loading && <p className="px-2 py-4 text-sm text-ink-400">Searching...</p>}
          {!loading && error && <p className="px-2 py-4 text-sm text-clay-700">Search failed. Please try again.</p>}
          {!loading && !error && query.trim() && results.length === 0 && <p className="px-2 py-4 text-sm text-ink-400">No matches for &quot;{query}&quot;.</p>}
          {!loading && !error && results.length > 0 && (
            <div className="space-y-2">
              {results.map((result, index) => (
                <Link key={`${result.href}-${result.type}-${index}`} href={result.href} onClick={onClose} className="block rounded-xl border border-ink-100 p-4 transition-colors hover:border-clay-300 hover:bg-ink-50">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={cx("badge capitalize", TYPE_COLORS[result.type] ?? "bg-ink-100 text-ink-600")}>{result.type.replace(/_/g, " ")}</span>
                    <span className="text-sm font-medium text-ink-800">{result.clientName}</span>
                  </div>
                  <p className="line-clamp-2 text-sm text-ink-600">{result.snippet}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
