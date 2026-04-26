import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FINANCE_T as T } from '../../theme/financeTheme';
import { fmtUSD } from './fmt';

const PALETTE = ['#86efac', '#818cf8', '#c4b5fd', '#fbbf24', '#fca5a5', '#7dd3fc', '#94a3b8'];

function FinanceTooltip({ active, payload, label, formatter = fmtUSD }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0f172a',
      border: `1px solid ${T.border}`,
      borderRadius: T.radius.md,
      padding: '0.55rem 0.7rem',
      boxShadow: T.shadow,
    }}>
      {label && (
        <div style={{ fontSize: T.font.xs, color: T.muted, marginBottom: '0.3rem' }}>
          {label}
        </div>
      )}
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: T.font.xs }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: entry.color }} />
          <span style={{ color: T.text }}>{entry.name}</span>
          <span style={{ color: T.textDim, fontWeight: 600 }}>{formatter(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function DonutBreakdown({
  data,
  centerLabel,
  centerValue,
  height = 250,
  legendPosition = 'side',
}) {
  if (!data?.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, fontSize: T.font.sm }}>
        No breakdown data yet.
      </div>
    );
  }

  const legendBelow = legendPosition === 'bottom';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: legendBelow ? 'minmax(0, 1fr)' : 'minmax(220px, 1fr) minmax(180px, 220px)',
      gap: legendBelow ? '0.85rem' : '1rem',
      alignItems: 'center',
      height: '100%',
    }}>
      <div style={{ width: '100%', height, margin: legendBelow ? '0 auto' : undefined, maxWidth: legendBelow ? 320 : undefined }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={64}
              outerRadius={88}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={entry.key || entry.label} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<FinanceTooltip />} />
            <text x="50%" y="48%" textAnchor="middle" fill={T.muted} fontSize="12">
              {centerLabel}
            </text>
            <text x="50%" y="58%" textAnchor="middle" fill={T.text} fontSize="18" fontFamily={T.display}>
              {centerValue}
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: legendBelow ? 'repeat(auto-fit, minmax(150px, 1fr))' : 'minmax(0, 1fr)',
        gap: legendBelow ? '0.6rem 1rem' : '0.55rem',
        alignItems: 'start',
      }}>
        {data.map((entry, index) => (
          <div key={entry.key || entry.label} style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto', gap: '0.6rem', alignItems: 'center' }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: PALETTE[index % PALETTE.length] }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: T.font.xs, color: T.text, whiteSpace: legendBelow ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.label}</div>
              <div style={{ fontSize: '0.68rem', color: T.muted }}>
                {entry.pct != null ? `${entry.pct}%` : ''}
              </div>
            </div>
            <div style={{ fontSize: T.font.xs, fontWeight: 600, color: T.textDim }}>
              {fmtUSD(entry.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendAreaChart({
  data,
  series,
  height = 280,
  formatter = fmtUSD,
  xAxisInterval,
}) {
  if (!data?.length || !series?.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, fontSize: T.font.sm }}>
        No trend data yet.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            {series.map((item) => (
              <linearGradient key={item.key} id={`grad-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={item.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={item.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke={T.borderSoft} />
          <XAxis
            dataKey="label"
            tick={{ fill: T.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={xAxisInterval}
          />
          <YAxis
            width={64}
            tick={{ fill: T.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => formatter(value)}
          />
          <Tooltip content={<FinanceTooltip formatter={formatter} />} />
          {series.map((item) => (
            <Area
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={item.color}
              fill={`url(#grad-${item.key})`}
              strokeWidth={2.4}
              dot={{ r: 2, strokeWidth: 0, fill: item.color }}
              activeDot={{ r: 4, fill: item.color }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ComparisonBars({
  data,
  layout = 'horizontal',
  height = 260,
  formatter = fmtUSD,
}) {
  if (!data?.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, fontSize: T.font.sm }}>
        No comparison data yet.
      </div>
    );
  }

  const isVerticalLayout = layout === 'vertical';
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout={isVerticalLayout ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 12, left: isVerticalLayout ? 8 : 12, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke={T.borderSoft} />
          {isVerticalLayout ? (
            <>
              <XAxis
                type="number"
                tick={{ fill: T.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => formatter(value)}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fill: T.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={84}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="label"
                tick={{ fill: T.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: T.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => formatter(value)}
                width={88}
              />
            </>
          )}
          <Tooltip content={<FinanceTooltip formatter={formatter} />} />
          <Bar dataKey="value" radius={[8, 8, 8, 8]}>
            {data.map((entry, index) => (
              <Cell key={entry.key || entry.label} fill={entry.color || PALETTE[index % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SplitProgressBar({
  leftLabel,
  leftValue,
  leftPct,
  rightLabel,
  rightValue,
  rightPct,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: T.font.xs, color: T.muted }}>
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div style={{ height: 14, borderRadius: 999, background: T.borderSoft, overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${leftPct}%`, background: 'linear-gradient(90deg, rgba(134,239,172,0.7), rgba(134,239,172,1))' }} />
        <div style={{ width: `${rightPct}%`, background: 'linear-gradient(90deg, rgba(252,165,165,0.7), rgba(252,165,165,1))' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: T.font.xs }}>
        <span style={{ color: T.green, fontWeight: 600 }}>{leftValue}</span>
        <span style={{ color: T.red, fontWeight: 600 }}>{rightValue}</span>
      </div>
    </div>
  );
}
