import type { TooltipProps } from 'recharts';

interface Row {
  label: string;
  value: string;
  color?: string;
}

/** Shared tooltip shell — surface/border/ink tokens, one row per series. */
export default function ChartTooltip({
  active,
  title,
  rows,
}: {
  active?: boolean;
  title?: string;
  rows: Row[];
}) {
  if (!active) return null;
  return (
    <div className="rounded-md border border-border bg-raised px-3 py-2 shadow-md text-xs min-w-[140px]">
      {title && <div className="text-ink-2 mb-1 font-medium">{title}</div>}
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted">
              {r.color && (
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
              )}
              {r.label}
            </span>
            <span className="text-ink font-mono tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { TooltipProps };
