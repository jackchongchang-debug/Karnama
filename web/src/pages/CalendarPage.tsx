import { useState } from 'react'
import { useHolidays, useProjects, useTasks } from '../lib/hooks'
import { MONTHS, WEEKDAYS, faNum, fixedHoliday, fmt, jParts, monthCells, shiftMonth, toISO, todayISO, weekdayIndex } from '../lib/date'
import { addTask } from '../lib/tasks'
import { ensureInbox } from '../lib/seed'
import TaskDialog from '../components/TaskDialog'
import Modal from '../components/Modal'
import './CalendarPage.css'

export default function CalendarPage() {
  const now = jParts(new Date())
  const [view, setView] = useState({ y: now.y, m: now.m })
  const [openTask, setOpenTask] = useState<string>()
  const [addFor, setAddFor] = useState<string>()
  const tasks = useTasks()
  const projects = useProjects()
  const holidays = useHolidays()
  const today = todayISO()

  const color = (pid: string) => projects.find((p) => p.id === pid)?.color ?? 'var(--primary)'
  const byDay = new Map<string, typeof tasks>()
  for (const t of tasks) {
    const d = t.dueDate ?? t.startDate
    if (!d || !projects.some((p) => p.id === t.projectId)) continue
    byDay.set(d, [...(byDay.get(d) ?? []), t])
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="grow">تقویم</h1>
        <button className="btn" onClick={() => setView(shiftMonth(view.y, view.m, -1))}>› ماه قبل</button>
        <strong style={{ minWidth: 120, textAlign: 'center' }}>{MONTHS[view.m]} {faNum(view.y)}</strong>
        <button className="btn" onClick={() => setView(shiftMonth(view.y, view.m, 1))}>ماه بعد ‹</button>
        <button className="btn" onClick={() => setView({ y: now.y, m: now.m })}>امروز</button>
      </div>
      <div className="cal card">
        {WEEKDAYS.map((w, i) => <div key={w} className={`cal-wd ${i === 6 ? 'off' : ''}`}>{w}</div>)}
        {monthCells(view.y, view.m).map((d, i) => {
          if (!d) return <div key={i} className="cal-cell empty-cell" />
          const iso = toISO(d)
          const holiday = fixedHoliday(d) ?? holidays.find((h) => h.date === iso)?.title
          const off = weekdayIndex(d) === 6 || holiday
          const items = byDay.get(iso) ?? []
          return (
            <div key={i} className={`cal-cell ${iso === today ? 'today' : ''}`} onClick={(e) => !(e.target as HTMLElement).closest('.cal-task, .cal-add') && setAddFor(iso)}>
              <div className="row">
                <span className={`cal-num ${off ? 'off' : ''}`}>{faNum(jParts(d).d)}</span>
                <span className="spacer" />
                <button className="btn ghost sm cal-add" onClick={() => setAddFor(iso)} aria-label="افزودن">+</button>
              </div>
              {holiday && <div className="cal-holiday">{holiday}</div>}
              {items.slice(0, 4).map((t) => (
                <div key={t.id} className={`cal-task ${t.done ? 'done' : ''}`} style={{ borderInlineStartColor: color(t.projectId) }} onClick={() => setOpenTask(t.id)}>
                  {t.title}
                </div>
              ))}
              {items.length > 4 && <div className="small muted">و {faNum(items.length - 4)} مورد دیگر</div>}
            </div>
          )
        })}
      </div>
      {openTask && <TaskDialog taskId={openTask} onClose={() => setOpenTask(undefined)} />}
      {addFor && <AddDialog date={addFor} onClose={() => setAddFor(undefined)} onCreated={setOpenTask} />}
    </div>
  )
}

function AddDialog({ date, onClose, onCreated }: { date: string; onClose: () => void; onCreated: (id: string) => void }) {
  const projects = useProjects().filter((p) => !p.archived)
  const [title, setTitle] = useState('')
  const [pid, setPid] = useState('')
  const submit = async () => {
    if (!title.trim()) return
    const p = projects.find((x) => x.id === pid) ?? (await ensureInbox())
    const t = await addTask(p, title.trim(), undefined, { dueDate: date })
    onClose()
    onCreated(t.id)
  }
  return (
    <Modal title={`وظیفه برای ${fmt(date, 'EEEE d MMMM')}`} onClose={onClose} footer={<button className="btn primary" onClick={submit}>افزودن</button>}>
      <form onSubmit={(e) => { e.preventDefault(); submit() }}>
        <input autoFocus className="input" placeholder="عنوان وظیفه" value={title} onChange={(e) => setTitle(e.target.value)} />
      </form>
      <select className="input" value={pid} onChange={(e) => setPid(e.target.value)}>
        <option value="">کارهای شخصی</option>
        {projects.filter((p) => p.id !== 'inbox').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </Modal>
  )
}
