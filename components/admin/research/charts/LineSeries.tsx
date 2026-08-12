'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
  type MouseHandlerDataParam,
} from 'recharts';
import ChartTooltip from './ChartTooltip';

export interface LineSeriesPoint {
  x: string;
  y: number;
  isFlagged?: boolean;
}

/**
 * Single-metric line-over-time chart (e.g. daily error rate). Flagged points
 * (spikes/anomalies) render as a status-colored marker with their own small
 * legend row — never color-alone, per the two-category status convention.
 */
export default function LineSeries({
  data,
  yLabel,
  yFormat = (v: number) => v.toFixed(2),
  flaggedLabel = 'Spike day',
  onPointClick,
}: {
  data: LineSeriesPoint[];
  yLabel: string;
  yFormat?: (v: number) => string;
  flaggedLabel?: string;
  onPointClick?: (point: LineSeriesPoint) => void;
}) {
  const hasFlags = data.some((d) => d.isFlagged);

  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            onClick={(e: MouseHandlerDataParam) => {
              const point = data.find((d) => d.x === e.activeLabel);
              if (point && onPointClick) onPointClick(point);
            }}
          >
            <CartesianGrid stroke="var(--grid)" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="x"
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--grid)' }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={yFormat}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border)' }}
              content={({ active, payload, label }) => {
                const point = payload?.[0]?.payload as LineSeriesPoint | undefined;
                return (
                  <ChartTooltip
                    active={active}
                    title={String(label)}
                    rows={[
                      { label: yLabel, value: point ? yFormat(point.y) : '—', color: 'var(--brand)' },
                      ...(point?.isFlagged ? [{ label: flaggedLabel, value: 'yes', color: 'var(--critical)' }] : []),
                    ]}
                  />
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="y"
              stroke="var(--brand)"
              strokeWidth={2}
              dot={(props: DotItemDotProps) => {
                const point = props.payload as LineSeriesPoint;
                if (!point.isFlagged) return <g key={`${point.x}`} />;
                return (
                  <circle
                    key={`${point.x}-flag`}
                    cx={props.cx}
                    cy={props.cy}
                    r={5}
                    fill="var(--critical)"
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 5, fill: 'var(--brand-hi)', stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {hasFlags && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--critical)' }} />
          {flaggedLabel} — error rate exceeded its 7-day rolling baseline by 2 std. deviations
        </div>
      )}
    </div>
  );
}
