'use client';

import { useState } from 'react';

export interface HeatmapCell {
  row: string;
  col: string;
  value: number;
  sampleSize?: number;
}

const HEAT_RAMP = ['var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)', 'var(--heat-5)'];

/**
 * Plain CSS-grid heatmap (row × col matrix) for small, fixed-size grids
 * (e.g. specificity tier × complexity bucket). Sequential single-hue ramp;
 * value shown on hover rather than crammed into every cell.
 */
export default function Heatmap({
  rows,
  cols,
  cells,
  valueFormat = (v: number) => `${(v * 100).toFixed(1)}%`,
  valueLabel,
}: {
  rows: string[];
  cols: string[];
  cells: HeatmapCell[];
  valueFormat?: (v: number) => string;
  valueLabel: string;
}) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);
  const max = Math.max(...cells.map((c) => c.value), 0.0001);

  const cellFor = (row: string, col: string) => cells.find((c) => c.row === row && c.col === col);

  return (
    <div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `120px repeat(${cols.length}, 1fr)` }}
      >
        <div />
        {cols.map((c) => (
          <div key={c} className="px-1 text-center text-xs text-muted">
            {c}
          </div>
        ))}
        {rows.map((r) => (
          <>
            <div key={`${r}-label`} className="flex items-center px-1 text-xs text-muted">
              {r}
            </div>
            {cols.map((c) => {
              const cell = cellFor(r, c);
              const step = cell ? Math.min(4, Math.floor((cell.value / max) * 5)) : 0;
              return (
                <div
                  key={`${r}-${c}`}
                  onMouseEnter={() => cell && setHovered(cell)}
                  onMouseLeave={() => setHovered(null)}
                  className="flex h-14 items-center justify-center rounded-md text-xs font-medium text-ink transition-transform hover:scale-[1.03]"
                  style={{ background: cell ? HEAT_RAMP[step] : 'var(--wash)' }}
                >
                  {cell ? valueFormat(cell.value) : '—'}
                </div>
              );
            })}
          </>
        ))}
      </div>
      <div className="mt-2 h-4 text-xs text-muted">
        {hovered ? `${valueLabel}: ${valueFormat(hovered.value)}${hovered.sampleSize != null ? ` · n=${hovered.sampleSize}` : ''}` : ''}
      </div>
    </div>
  );
}
