'use client';

import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import ChartTooltip from './ChartTooltip';

export interface ScatterPoint {
  x: number;
  y: number;
  isError: boolean;
  label?: string;
}

/**
 * Binary-status scatter (e.g. context fill % vs turn outcome). Status color
 * is reserved for error/ok only — never reused as a third "series" — and
 * ships with an explicit legend, not color alone.
 */
export default function ScatterPlot({
  data,
  xLabel,
  yLabel,
  xFormat = (v: number) => v.toFixed(0),
}: {
  data: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xFormat?: (v: number) => string;
}) {
  const ok = data.filter((d) => !d.isError);
  const errored = data.filter((d) => d.isError);

  return (
    <div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="0" />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--grid)' }}
              tickFormatter={xFormat}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border)' }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as ScatterPoint | undefined;
                if (!point) return null;
                return (
                  <ChartTooltip
                    active={active}
                    title={point.label}
                    rows={[
                      { label: xLabel, value: xFormat(point.x) },
                      {
                        label: 'Outcome',
                        value: point.isError ? 'tool error' : 'ok',
                        color: point.isError ? 'var(--critical)' : 'var(--good)',
                      },
                    ]}
                  />
                );
              }}
            />
            <Scatter data={ok} fill="var(--good)" fillOpacity={0.55} r={4} isAnimationActive={false} />
            <Scatter data={errored} fill="var(--critical)" r={4} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--good)' }} />
          Ok ({ok.length})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--critical)' }} />
          Tool error ({errored.length})
        </span>
      </div>
    </div>
  );
}
