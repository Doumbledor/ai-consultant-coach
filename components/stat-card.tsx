interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  highlight?: boolean
}

export function StatCard({ title, value, subtitle, highlight = false }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        highlight
          ? 'border-emerald-500 bg-emerald-950/30'
          : 'border-slate-700 bg-slate-800'
      }`}
    >
      <p className="text-sm text-slate-400">{title}</p>
      <p
        className={`mt-1 text-3xl font-bold ${
          highlight ? 'text-emerald-400' : 'text-white'
        }`}
      >
        {value}
      </p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  )
}
