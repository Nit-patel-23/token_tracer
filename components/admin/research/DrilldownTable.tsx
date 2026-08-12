export interface DrilldownColumn<T> {
  key: keyof T & string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

/** Plain data table for drill-down rows (sessions, tool calls, prompts). */
export default function DrilldownTable<T>({
  columns,
  rows,
  emptyLabel = 'No rows for this selection.',
}: {
  columns: DrilldownColumn<T>[];
  rows: T[];
  emptyLabel?: string;
}) {
  if (!rows.length) {
    return <div className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-muted">{emptyLabel}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr key={i} className="text-ink hover:bg-wash">
              {columns.map((c) => (
                <td key={c.key} className="whitespace-nowrap px-3 py-2 font-mono tabular-nums">
                  {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
