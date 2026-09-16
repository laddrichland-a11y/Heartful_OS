import Link from "next/link";

const ITEMS = [
  { label: "Overview", href: "/reports", key: "overview" },
  { label: "Revenue", href: "/reports/revenue", key: "revenue" },
] as const;

export default function ReportsNav({ current }: { current: "overview" | "revenue" }) {
  return <nav className="reports-tabs" aria-label="Reports views">
    {ITEMS.map((item) => <Link key={item.key} href={item.href} aria-current={current === item.key ? "page" : undefined}>{item.label}</Link>)}
  </nav>;
}
