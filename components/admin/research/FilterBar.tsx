'use client';

import { useResearchFilters } from '@/lib/admin/research/useResearchFilters';

const RANGES = [
  { value: '7d', label: '7d' },
  { value: '14d', label: '14d' },
  { value: '30d', label: '30d' },
  { value: '60d', label: '60d' },
  { value: '90d', label: '90d' },
];

/**
 * Shared range/org/tool/model filter row for the research surface. State
 * lives in the URL (useResearchFilters), so every study/tab reads the same
 * filters and a drill-down link elsewhere can just set the query string.
 */
export default function FilterBar({
  toolOptions = [],
  modelOptions = [],
  showOrg = false,
}: {
  toolOptions?: string[];
  modelOptions?: string[];
  showOrg?: boolean;
}) {
  const { filters, setFilter } = useResearchFilters();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      <div className="flex items-center gap-1 rounded-md bg-page p-0.5">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setFilter('range', r.value)}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              filters.range === r.value
                ? 'bg-brand text-brand-ink font-medium'
                : 'text-muted hover:text-ink'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {showOrg && (
        <input
          type="text"
          placeholder="Org ID…"
          defaultValue={filters.org ?? ''}
          onBlur={(e) => setFilter('org', e.target.value || null)}
          className="w-40 rounded-md border border-border bg-page px-2 py-1 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-dim"
        />
      )}

      {toolOptions.length > 0 && (
        <select
          value={filters.tool ?? ''}
          onChange={(e) => setFilter('tool', e.target.value || null)}
          className="rounded-md border border-border bg-page px-2 py-1 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand-dim"
        >
          <option value="">All tools</option>
          {toolOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}

      {modelOptions.length > 0 && (
        <select
          value={filters.model ?? ''}
          onChange={(e) => setFilter('model', e.target.value || null)}
          className="rounded-md border border-border bg-page px-2 py-1 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand-dim"
        >
          <option value="">All models</option>
          {modelOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      )}

      {(filters.org || filters.tool || filters.model) && (
        <button
          type="button"
          onClick={() => {
            setFilter('org', null);
            setFilter('tool', null);
            setFilter('model', null);
          }}
          className="text-xs text-muted hover:text-ink underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
