import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import SyncBadge from './SyncBadge'
import Toasts from './Toasts'
import './Layout.css'

const NAV = [
  { to: '/', label: 'داشبورد', icon: '▦', end: true },
  { to: '/tasks', label: 'کارهای من', icon: '✓' },
  { to: '/projects', label: 'پروژه‌ها', icon: '▤' },
  { to: '/calendar', label: 'تقویم', icon: '◫' },
  { to: '/notes', label: 'یادداشت‌ها', icon: '✎' },
  { to: '/customers', label: 'مشتریان', icon: '☺' },
  { to: '/templates', label: 'قالب‌ها', icon: '⧉' },
  { to: '/settings', label: 'تنظیمات', icon: '⚙' },
]

export default function Layout() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={28} height={28} />
          <span>کارنما</span>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <SyncBadge />
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main className="main">
        <header className="topbar">
          <button className="btn ghost" onClick={() => setOpen(true)} aria-label="منو">☰</button>
          <span className="brand-sm">کارنما</span>
        </header>
        <Outlet />
      </main>
      <Toasts />
    </div>
  )
}
