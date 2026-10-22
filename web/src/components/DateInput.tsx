import { useEffect, useRef, useState } from 'react'
import { MONTHS, WEEKDAYS, faNum, fmt, fromISO, jParts, monthCells, shiftMonth, toISO, todayISO, fixedHoliday, weekdayIndex } from '../lib/date'
import './DateInput.css'

/** A Jalali date picker that reads and writes Gregorian ISO day strings. */
export default function DateInput({
  value,
  onChange,
  placeholder = 'انتخاب تاریخ',
}: {
  value?: string
  onChange: (v: string | undefined) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const start = jParts(fromISO(value ?? todayISO()))
  const [view, setView] = useState({ y: start.y, m: start.m })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const today = todayISO()
  return (
    <div className="date-input" ref={ref}>
      <div className="row">
        <button type="button" className="input date-btn" onClick={() => {
          const p = jParts(fromISO(value ?? todayISO()))
          setView({ y: p.y, m: p.m })
          setOpen(!open)
        }}>
          {value ? fmt(value, 'EEEE d MMMM yyyy') : <span className="muted">{placeholder}</span>}
        </button>
        {value && (
          <button type="button" className="btn ghost sm" onClick={() => onChange(undefined)} aria-label="پاک کردن">✕</button>
        )}
      </div>
      {open && (
        <div className="date-pop card">
          <div className="row">
            <button type="button" className="btn ghost sm" onClick={() => setView(shiftMonth(view.y, view.m, -1))}>›</button>
            <strong className="grow" style={{ textAlign: 'center' }}>{MONTHS[view.m]} {faNum(view.y)}</strong>
            <button type="button" className="btn ghost sm" onClick={() => setView(shiftMonth(view.y, view.m, 1))}>‹</button>
          </div>
          <div className="date-grid">
            {WEEKDAYS.map((w) => <span key={w} className="muted small">{w[0]}</span>)}
            {monthCells(view.y, view.m).map((d, i) => {
              if (!d) return <span key={i} />
              const iso = toISO(d)
              const holiday = weekdayIndex(d) === 6 || fixedHoliday(d)
              return (
                <button
                  type="button"
                  key={i}
                  className={`day ${iso === value ? 'sel' : ''} ${iso === today ? 'today' : ''} ${holiday ? 'holiday' : ''}`}
                  onClick={() => { onChange(iso); setOpen(false) }}
                >
                  {faNum(jParts(d).d)}
                </button>
              )
            })}
          </div>
          <button type="button" className="btn sm" onClick={() => { onChange(today); setOpen(false) }}>امروز</button>
        </div>
      )}
    </div>
  )
}
