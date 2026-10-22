import { addDaysISO, daysBetween, faNum, fixedHoliday, fromISO, jParts, MONTHS, todayISO, weekdayIndex } from '../lib/date'
import type { Task } from '../lib/db'
import './Gantt.css'

const DAY = 30

/** A right-to-left Gantt chart over the Jalali calendar. */
export default function Gantt({ tasks, onOpen, color, showProject }: { tasks: Task[]; onOpen: (id: string) => void; color: string; showProject?: (t: Task) => string }) {
  const rows = tasks
    .map((t) => {
      const start = t.startDate ?? t.dueDate ?? t.endDate
      const end = t.endDate ?? t.dueDate ?? t.startDate
      return start && end ? { t, start: start <= end ? start : end, end: start <= end ? end : start } : null
    })
    .filter((r) => r !== null)
    .sort((a, b) => a.start.localeCompare(b.start))
  const undated = tasks.length - rows.length

  if (rows.length === 0) return <div className="empty">برای نمایش در گانت، به وظایف تاریخ شروع و پایان بدهید.</div>

  const today = todayISO()
  const first = addDaysISO([rows[0].start, today].sort()[0], -3)
  const last = addDaysISO([...rows.map((r) => r.end), today].sort().at(-1)!, 5)
  const days = Array.from({ length: daysBetween(first, last) + 1 }, (_, i) => addDaysISO(first, i))
  const months: { label: string; span: number }[] = []
  for (const d of days) {
    const p = jParts(fromISO(d))
    const label = `${MONTHS[p.m]} ${faNum(p.y)}`
    if (months.at(-1)?.label === label) months.at(-1)!.span++
    else months.push({ label, span: 1 })
  }
  const width = days.length * DAY

  return (
    <div className="col">
      <div className="gantt card">
        <div className="gantt-names">
          <div className="gantt-corner">وظیفه</div>
          {rows.map(({ t }) => (
            <div key={t.id} className="gantt-name" onClick={() => onOpen(t.id)} title={t.title}>
              {showProject && <span className="muted small">{showProject(t)} · </span>}
              {t.title}
            </div>
          ))}
        </div>
        <div className="gantt-scroll">
          <div style={{ width }}>
            <div className="gantt-months">
              {months.map((m, i) => <div key={i} style={{ width: m.span * DAY }}>{m.label}</div>)}
            </div>
            <div className="gantt-days">
              {days.map((d) => {
                const date = fromISO(d)
                const off = weekdayIndex(date) === 6 || fixedHoliday(date)
                return <div key={d} className={`${off ? 'off' : ''} ${d === today ? 'today' : ''}`}>{faNum(jParts(date).d)}</div>
              })}
            </div>
            <div className="gantt-body" style={{ backgroundSize: `${DAY}px 100%` }}>
              <div className="gantt-today" style={{ insetInlineStart: daysBetween(first, today) * DAY + DAY / 2 }} />
              {rows.map(({ t, start, end }) => (
                <div key={t.id} className="gantt-row">
                  <div
                    className={`gantt-bar ${t.done ? 'done' : ''}`}
                    style={{ insetInlineStart: daysBetween(first, start) * DAY + 2, width: (daysBetween(start, end) + 1) * DAY - 4, background: color }}
                    onClick={() => onOpen(t.id)}
                    title={t.title}
                  >
                    {t.title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {undated > 0 && <div className="small muted">{faNum(undated)} وظیفه بدون تاریخ در گانت نمایش داده نشده است.</div>}
    </div>
  )
}
