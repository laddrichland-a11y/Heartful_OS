"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="text-sm text-ink-500 hover:text-ink-800 flex items-center gap-1 mb-4"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
