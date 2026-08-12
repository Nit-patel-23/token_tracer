'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartTooltip from './ChartTooltip';

export interface HistogramBar {
  bucket: string;
  value: number;
  sampleSize?: number;
}

const HEAT_RAMP = ['var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)', 'var(--heat-5)'];

/** Ordered-bucket bar chart with sequential (single-hue) heat coloring by magnitude. */
export default function Histogram({
  data,
  valueLabel,
  valueFormat = (v: number) => `${(v * 100).toFixed(1)}%`,
}: {
  data: HistogramBar[];
  valueLabel: string;
  valueFormat?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 0.0001);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap={4}>
          <CartesianGrid stroke="var(--grid)" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="bucket"
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--grid)' }}
          />
          <YAxis
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={valueFormat}
          />
          <Tooltip
            cursor={{ fill: 'var(--wash)' }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as HistogramBar | undefined;
              if (!point) return null;
              return (
                <ChartTooltip
                  active={active}
                  title={point.bucket}
                  rows={[
                    { label: valueLabel, value: valueFormat(point.value), color: 'var(--brand)' },
                    ...(point.sampleSize != null ? [{ label: 'Samples', value: String(point.sampleSize) }] : []),
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => {
              const step = Math.min(4, Math.floor((d.value / max) * 5));
              return <Cell key={i} fill={HEAT_RAMP[step]} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
