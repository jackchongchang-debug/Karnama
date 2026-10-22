import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomerRecords, useProjects, useTasks } from '../lib/hooks'
import { addDaysISO, faMoney, faNum, fmt, toISO, todayISO } from '../lib/date'
import { completeTask, groupTasks, progress, reopenTask } from '../lib/tasks'
import { forecast } from '../lib/crm'
import TaskCard from '../components/TaskCard'
import TaskDialog from '../components/TaskDialog'
import type { Task } from '../lib/db'

export default function Dashboard() {
  const projects = useProjects().filter((p) => !p.archived)
  const tasks = useTasks().filter((t) => projects.some((p) => p.id === t.projectId))
  const { finances, leads } = useCustomerRecords()
  const [openTask, setOpenTask] = useState<string>()
  const today = todayISO()

  const groups = groupTasks(tasks)
  const overdue = groups[0].items
  const dueToday = groups[1].items
  const weekAgo = addDaysISO(today, -6)
  const doneDay = (t: Task) => (t.completedAt ? toISO(new Date(t.completedAt)) : undefined)
  const doneWeek = tasks.filter((t) => t.done && (doneDay(t) ?? '') >= weekAgo).length
  const days = Array.from({ length: 14 }, (_, i) => addDaysISO(today, i - 13))
  const perDay = days.map((d) => tasks.filter((t) => doneDay(t) === d).length)
  const maxDay = Math.max(1, ...perDay)
  const nextMonths = forecast(finances, leads, 3)
  const toggle = (t: Task) => {
    const p = projects.find((x) => x.id === t.projectId)
    if (p) return t.done ? reopenTask(t, p) : completeTask(t, p)
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="grow">داشبورد</h1>
        <span className="muted">{fmt(today, 'EEEE d MMMM yyyy')}</span>
      </div>

      <div className="stats">
        <Stat label="کارهای باز" value={tasks.filter((t) => !t.done).length} />
        <Stat label="برای امروز" value={dueToday.length} />
        <Stat label="عقب‌افتاده" value={overdue.length} danger={overdue.length > 0} />
        <Stat label="انجام‌شده در ۷ روز" value={doneWeek} />
      </div>

      <div className="dash-grid">
        <section className="card dash-card">
          <h3>امروز و عقب‌افتاده‌ها</h3>
          {[...overdue, ...dueToday].slice(0, 8).map((t) => (
            <TaskCard key={t.id} task={t} projectName={projects.find((p) => p.id === t.projectId)?.name} onOpen={() => setOpenTask(t.id)} onToggle={() => toggle(t)} />
          ))}
          {overdue.length + dueToday.length === 0 && <div className="muted">برای امروز کاری ندارید.</div>}
          <Link to="/tasks" className="small">همه‌ی کارها ←</Link>
        </section>

        <section className="card dash-card">
          <h3>کارهای انجام‌شده در ۱۴ روز اخیر</h3>
          <div className="bars">
            {perDay.map((n, i) => (
              <div key={i} className="bar-col" title={`${fmt(days[i], 'd MMMM')}: ${faNum(n)}`}>
                <div className="bar" style={{ height: `${(n / maxDay) * 100}%` }} />
                <span className="small muted">{fmt(days[i], 'd')}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card dash-card">
          <h3>پیشرفت پروژه‌ها</h3>
          {projects.map((p) => {
            const pt = tasks.filter((t) => t.projectId === p.id)
            const pct = progress(pt)
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="col" style={{ gap: 4, color: 'inherit' }}>
                <div className="row small"><span className="dot" style={{ background: p.color }} /><span className="grow">{p.name}</span><span>{faNum(pct)}٪</span></div>
                <div className="progress"><div style={{ width: `${pct}%`, background: p.color }} /></div>
              </Link>
            )
          })}
          {projects.length === 0 && <div className="muted">پروژه‌ای نیست. <Link to="/projects">بسازید</Link></div>}
        </section>

        <section className="card dash-card">
          <h3>درآمد پیش‌بینی‌شده</h3>
          {nextMonths.map((m) => (
            <div key={m.label} className="row small"><span className="grow">{m.label}</span><strong>{faMoney(m.invoices + m.leads)}</strong></div>
          ))}
          <div className="small muted">فرصت‌های فروش باز: {faNum(leads.filter((l) => !['won', 'lost'].includes(l.stage)).length)}</div>
          <Link to="/customers" className="small">مدیریت مشتریان ←</Link>
        </section>
      </div>
      {openTask && <TaskDialog taskId={openTask} onClose={() => setOpenTask(undefined)} />}
    </div>
  )
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="card stat">
      <span className="muted small">{label}</span>
      <strong style={danger ? { color: 'var(--danger)' } : undefined}>{faNum(value)}</strong>
    </div>
  )
}
