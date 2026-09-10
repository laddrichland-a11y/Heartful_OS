import { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cx } from "@/lib/utils";

export default function StatCard({
  label,
  value,
  icon: Icon,
  accent = "clay",
  sub,
  href,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "clay" | "sage" | "plum" | "ink";
  sub?: string;
  href?: string;
}) {
  const inner = (
    <div className="card p-4 flex items-start gap-3 h-full">
      <div
        className={cx(
          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
          accent === "clay" && "bg-clay-100 text-clay-600",
          accent === "sage" && "bg-sage-100 text-sage-700",
          accent === "plum" && "bg-plum-100 text-plum-700",
          accent === "ink" && "bg-ink-100 text-ink-600"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-semibold text-ink-900 leading-tight">{value}</div>
        <div className="text-xs text-ink-500">{label}</div>
        {sub && <div className="text-[11px] text-ink-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:opacity-80 transition-opacity rounded-2xl">
        {inner}
      </Link>
    );
  }

  return inner;
}
