"use client";

import { useState, useTransition } from "react";
import AppShell from "@/components/layout/AppShell";
import Link from "next/link";
import { Search as SearchIcon } from "@/components/ui/HeartfulIcon";
import { cx } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, startTransition] = useTransition();
  const [searched, setSearched] = useState(false);

  function runSearch(q: string) {
    setQuery(q);
    startTransition(async () => {
      if (!q.trim()) {
        setResults([]);
        setSearched(false);
        return;
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.results);
      setSearched(true);
    });
  }

  return (
    <AppShell title="Search">
      <div className="max-w-2xl">
        <div className="relative mb-6">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="Search clients, transcripts, session notes, themes, intentions, action items, insights..."
            className="w-full border border-ink-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
          />
        </div>
      </div>

      {pending && <p className="text-sm text-ink-400">Searching...</p>}

      {!pending && searched && results.length === 0 && (
        <p className="text-sm text-ink-400">No matches for &quot;{query}&quot;.</p>
      )}

      <div className="space-y-2 max-w-3xl">
        {results.map((r, i) => (
          <Link
            key={i}
            href={r.href}
            className="block card p-4 hover:border-clay-300 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={cx("badge capitalize", TYPE_COLORS[r.type] ?? "bg-ink-100 text-ink-600")}>
                {r.type.replace(/_/g, " ")}
              </span>
              <span className="text-sm font-medium text-ink-800">{r.clientName}</span>
            </div>
            <p className="text-sm text-ink-600 line-clamp-2">{r.snippet}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
