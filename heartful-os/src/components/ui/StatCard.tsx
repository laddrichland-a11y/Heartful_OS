import type { HeartfulIcon } from "@/components/ui/HeartfulIcon";
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
  icon: HeartfulIcon;
  accent?: "clay" | "sage" | "plum" | "ink";
  sub?: string;
  href?: string;
}) {
  const inner = (
    <div className="card summary-card p-4 flex items-start gap-3 h-full">
      <div
        className={cx(
          "summary-icon h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
          accent === "clay" && "bg-clay-100 text-clay-600",
          accent === "sage" && "bg-sage-100 text-sage-700",
          accent === "plum" && "bg-plum-100 text-plum-700",
          accent === "ink" && "bg-ink-100 text-ink-600"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-xl font-semibold text-ink-900 leading-tight">{value}</div>
        <div className="text-sm text-ink-500">{label}</div>
        {sub && <div className="text-xs text-ink-400 mt-1 leading-relaxed">{sub}</div>}
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
