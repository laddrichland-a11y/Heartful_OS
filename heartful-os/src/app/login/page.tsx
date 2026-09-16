"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction } from "@/lib/actions";
import { HeartHandshake } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await loginAction(password);
    if (result.ok) {
      router.push(searchParams.get("next") || "/dashboard");
      router.refresh();
    } else {
      setBusy(false);
      setError("Incorrect password.");
    }
  }

  return (
    <div className="auth-shell min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="card p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-clay-500 text-white flex items-center justify-center">
            <HeartHandshake className="h-4.5 w-4.5" />
          </div>
          <div className="font-semibold text-ink-900">Heartful OS</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm text-ink-700 block mb-1.5">Password</label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
            />
          </div>
          {error && <p className="text-xs text-clay-600">{error}</p>}
          <button type="submit" disabled={busy || !password} className="btn-primary text-sm px-4 py-2 w-full disabled:opacity-50">
            {busy ? "Checking..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
