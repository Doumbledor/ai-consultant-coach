import {
  getSessionStats,
  getDailyRevenue,
  getUpcomingSessions,
  getRecentSessions,
} from '@/lib/data/sessions'
import { StatCard } from '@/components/stat-card'
import { RevenueChart } from '@/components/revenue-chart'
import Link from 'next/link'

const BREAK_EVEN = 20

export default async function OverviewPage() {
  const [stats, dailyRevenue, upcoming, recent] = await Promise.all([
    getSessionStats(),
    getDailyRevenue(30),
    getUpcomingSessions(3),
    getRecentSessions(5),
  ])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Overview</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Sessions" value={stats.totalSessions} subtitle="All time" />
        <StatCard title="Revenue MTD" value={`$${stats.revenueMtd}`} subtitle="Month to date" />
        <StatCard title="Upcoming" value={stats.upcomingCount} subtitle="Next 7 days" />
        <StatCard
          title="Break-even"
          value={`${stats.thisMonthCount}/${BREAK_EVEN}`}
          subtitle={stats.thisMonthCount >= BREAK_EVEN ? 'Reached!' : 'Bookings this month'}
          highlight={stats.thisMonthCount >= BREAK_EVEN}
        />
      </div>

      <div className="mb-8">
        <RevenueChart data={dailyRevenue} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
          <h2 className="mb-4 text-sm font-medium text-slate-400">Upcoming Sessions</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming sessions.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((s) => (
                <li key={s.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{s.customer_email}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(s.scheduled_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                    {s.session_type === 'session_1' ? 'Session 1' : 'Session 2'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
          <h2 className="mb-4 text-sm font-medium text-slate-400">Recent Sessions</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">No completed sessions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2 font-normal">Customer</th>
                  <th className="pb-2 font-normal">Date</th>
                  <th className="pb-2 font-normal">Type</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-700/50">
                    <td className="py-1.5">
                      <Link
                        href={`/dashboard/call-review/${s.id}`}
                        className="text-indigo-400 hover:text-indigo-300"
                      >
                        {s.customer_email}
                      </Link>
                    </td>
                    <td className="py-1.5 text-slate-400">
                      {new Date(s.scheduled_at).toLocaleDateString()}
                    </td>
                    <td className="py-1.5 text-slate-400">
                      {s.session_type === 'session_1' ? 'Session 1' : 'Session 2'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
