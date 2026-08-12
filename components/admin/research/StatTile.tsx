export default function StatTile({
  label,
  value,
  delta,
  deltaGood,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaGood?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-ink">{value}</span>
        {delta && (
          <span className={deltaGood ? 'text-xs text-good' : 'text-xs text-critical'}>{delta}</span>
        )}
      </div>
    </div>
  );
}
