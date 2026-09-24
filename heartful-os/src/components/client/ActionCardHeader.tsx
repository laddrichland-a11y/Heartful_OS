import type { ReactNode } from "react";

export default function ActionCardHeader({
  title,
  description,
  action,
  titleAs = "h3",
  titleAction,
}: {
  title: ReactNode;
  description: ReactNode;
  action: ReactNode;
  titleAs?: "h2" | "h3";
  titleAction?: ReactNode;
}) {
  const Title = titleAs;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-48 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Title className="action-card-heading flex items-center gap-3 font-semibold text-ink-900">{title}</Title>
          {titleAction}
        </div>
        <p className="text-sm text-ink-400">{description}</p>
      </div>
      <div className="shrink-0 self-end">{action}</div>
    </div>
  );
}
