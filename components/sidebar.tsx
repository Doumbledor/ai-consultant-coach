'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '📊' },
  { href: '/dashboard/sessions', label: 'Sessions', icon: '📅' },
  { href: '/dashboard/call-review', label: 'Call Review', icon: '🎥' },
  { href: '/dashboard/knowledge-base', label: 'Knowledge Base', icon: '🧠' },
  { href: '/dashboard/live', label: 'Live', icon: '🔴' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-48 min-h-screen bg-slate-950 border-r border-slate-800 flex flex-col p-3">
      <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider px-2 mb-4">
        Doumbledor
      </div>
      <nav className="flex flex-col gap-1">
        {navItems.map(item => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
