'use client'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { DailyRevenue } from '@/lib/data/sessions'

interface RevenueChartProps {
  data: DailyRevenue[]
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
      <h2 className="mb-4 text-sm font-medium text-slate-400">Revenue — Last 30 Days</h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickFormatter={(v: number) => `$${v}`}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }}
            formatter={(v) => [`$${v}`, 'Revenue']}
          />
          <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
