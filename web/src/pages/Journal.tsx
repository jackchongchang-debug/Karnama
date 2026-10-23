import { useMemo, useState } from 'react'
import { useJournal } from '../lib/hooks'
import { create, db, remove, update, type JournalEntry } from '../lib/db'
import { MONTHS, WEEKDAYS, addDaysISO, faNum, fmt, fromISO, jParts, todayISO, weekdayIndex } from '../lib/date'
import { download } from '../lib/importers'
import Modal from '../components/Modal'
import DateInput from '../components/DateInput'
import TagInput from '../components/TagInput'
import VoiceButton from '../components/VoiceButton'
import './Journal.css'

type View = 'table' | 'timeline' | 'report'

interface Filters {
  q: string
  from?: string
  to?: string
  tags: string[]
}

const gregorian = (iso: string) => iso.replace(/-/g, '/')
const jalali = (iso: string) => fmt(iso, 'yyyy/MM/dd')

export default function Journal() {
  const entries = useJournal()
  const [view, setView] = useState<View>('table')
  const [f, setF] = useState<Filters>({ q: '', tags: [] })
  const [editing, setEditing] = useState<string>()
  const [asc, setAsc] = useState(false)

  const allTags = useMemo(() => {
    const count = new Map<string, number>()
    for (const e of entries) for (const t of e.tags) count.set(t, (count.get(t) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [entries])

  const filtered = entries
    .filter((e) => !f.from || e.date >= f.from)
    .filter((e) => !f.to || e.date <= f.to)
    .filter((e) => f.tags.every((t) => e.tags.includes(t)))
    .filter((e) => !f.q || [e.title, e.body, ...e.tags].some((s) => s.includes(f.q)))
  const sorted = asc ? [...filtered].reverse() : filtered
  const active = !!(f.q || f.from || f.to || f.tags.length)

  const exportCSV = () => {
    const cell = (s: string) => `"${s.replace(/"/g, '""')}"`
    const rows = [
      ['تاریخ میلادی', 'تاریخ شمسی', 'عنوان', 'شرح', 'برچسب‌ها'],
      ...sorted.map((e) => [gregorian(e.date), fmt(e.date, 'yyyy/MM/dd').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))), e.title, e.body, e.tags.join('، ')]),
    ]
    // BOM so Excel opens the Persian text as UTF-8.
    download(`karnama-journal-${todayISO()}.csv`, '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n'), 'text/csv;charset=utf-8')
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="grow">رویدادنامه</h1>
        <button className="btn" onClick={exportCSV} disabled={!sorted.length}>خروجی اکسل</button>
        <button className="btn primary" onClick={async () => setEditing((await create('journal', { date: todayISO(), title: '', body: '', tags: [] })).id)}>
          + رویداد جدید
        </button>
      </div>

      <div className="card journal-filters">
        <input className="input" placeholder="جستجو در عنوان، شرح و برچسب‌ها…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <div className="row wrap">
          <span className="small muted">از</span>
          <div style={{ width: 210 }}><DateInput value={f.from} onChange={(from) => setF({ ...f, from })} placeholder="ابتدا" /></div>
          <span className="small muted">تا</span>
          <div style={{ width: 210 }}><DateInput value={f.to} onChange={(to) => setF({ ...f, to })} placeholder="امروز" /></div>
          <QuickRanges onPick={(from, to) => setF({ ...f, from, to })} />
        </div>
        {allTags.length > 0 && (
          <div className="row wrap">
            <span className="small muted">برچسب:</span>
            {allTags.map((t) => (
              <button
                key={t}
                className="chip"
                style={{ cursor: 'pointer', border: '1px solid var(--primary)', background: f.tags.includes(t) ? 'var(--primary)' : 'transparent', color: f.tags.includes(t) ? '#fff' : 'var(--primary)' }}
                onClick={() => setF({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] })}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        {active && (
          <div className="row small">
            <span className="muted">{faNum(filtered.length)} رویداد از {faNum(entries.length)}</span>
            <button className="btn ghost sm" onClick={() => setF({ q: '', tags: [] })}>پاک کردن فیلترها</button>
          </div>
        )}
      </div>

      <div className="tabs">
        {(['table', 'timeline', 'report'] as View[]).map((v) => (
          <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
            {{ table: 'جدول', timeline: 'تایم‌لاین', report: 'گزارش' }[v]}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="empty">هنوز رویدادی ثبت نکرده‌اید. با «رویداد جدید» شروع کنید.</div>
      ) : filtered.length === 0 ? (
        <div className="empty">رویدادی با این فیلترها پیدا نشد.</div>
      ) : view === 'table' ? (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table journal-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => setAsc(!asc)}>تاریخ میلادی {asc ? '▲' : '▼'}</th>
                <th>تاریخ شمسی</th>
                <th>عنوان</th>
                <th>شرح</th>
                <th>برچسب‌ها</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.id} onClick={() => setEditing(e.id)}>
                  <td dir="ltr" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{gregorian(e.date)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{jalali(e.date)}</td>
                  <td><strong>{e.title || <span className="muted">بدون عنوان</span>}</strong></td>
                  <td className="journal-body-cell">{e.body}</td>
                  <td><div className="row wrap" style={{ gap: 4 }}>{e.tags.map((t) => <span key={t} className="chip">{t}</span>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === 'timeline' ? (
        <Timeline entries={sorted} onOpen={setEditing} />
      ) : (
        <Report entries={filtered} onTag={(t) => setF({ ...f, tags: [t] })} />
      )}

      {editing && <EntryDialog id={editing} suggestions={allTags} onClose={() => setEditing(undefined)} />}
    </div>
  )
}

function QuickRanges({ onPick }: { onPick: (from?: string, to?: string) => void }) {
  const today = todayISO()
  const back = (days: number) => addDaysISO(today, -days)
  return (
    <>
      <button className="btn sm" onClick={() => onPick(back(6), today)}>۷ روز اخیر</button>
      <button className="btn sm" onClick={() => onPick(back(29), today)}>۳۰ روز اخیر</button>
      <button className="btn sm" onClick={() => onPick(back(364), today)}>یک سال اخیر</button>
    </>
  )
}

function Timeline({ entries, onOpen }: { entries: JournalEntry[]; onOpen: (id: string) => void }) {
  const groups: { label: string; items: JournalEntry[] }[] = []
  for (const e of entries) {
    const p = jParts(fromISO(e.date))
    const label = `${MONTHS[p.m]} ${faNum(p.y)}`
    if (groups.at(-1)?.label === label) groups.at(-1)!.items.push(e)
    else groups.push({ label, items: [e] })
  }
  return (
    <div className="timeline">
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="timeline-month">{g.label}</h3>
          {g.items.map((e) => {
            const d = fromISO(e.date)
            return (
              <div key={e.id} className="timeline-item" onClick={() => onOpen(e.id)}>
                <div className="timeline-date">
                  <strong>{faNum(jParts(d).d)}</strong>
                  <span className="small muted">{WEEKDAYS[weekdayIndex(d)]}</span>
                  <span className="small muted" dir="ltr">{gregorian(e.date)}</span>
                </div>
                <div className="timeline-dot" />
                <div className="card timeline-card">
                  <strong>{e.title || <span className="muted">بدون عنوان</span>}</strong>
                  {e.body && <div className="timeline-body">{e.body}</div>}
                  {e.tags.length > 0 && <div className="row wrap" style={{ gap: 4 }}>{e.tags.map((t) => <span key={t} className="chip">{t}</span>)}</div>}
                </div>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}

function Report({ entries, onTag }: { entries: JournalEntry[]; onTag: (t: string) => void }) {
  const byMonth = new Map<string, { label: string; n: number }>()
  const byTag = new Map<string, number>()
  const byWeekday = Array(7).fill(0) as number[]
  for (const e of entries) {
    const d = fromISO(e.date)
    const p = jParts(d)
    const key = `${p.y}-${String(p.m).padStart(2, '0')}`
    byMonth.set(key, { label: `${MONTHS[p.m]} ${faNum(p.y)}`, n: (byMonth.get(key)?.n ?? 0) + 1 })
    for (const t of e.tags) byTag.set(t, (byTag.get(t) ?? 0) + 1)
    byWeekday[weekdayIndex(d)]++
  }
  const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v)
  const tags = [...byTag.entries()].sort((a, b) => b[1] - a[1])
  const dates = entries.map((e) => e.date).sort()
  const days = new Set(dates).size

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="stats">
        <div className="card stat"><span className="muted small">تعداد رویدادها</span><strong>{faNum(entries.length)}</strong></div>
        <div className="card stat"><span className="muted small">روزهای ثبت‌شده</span><strong>{faNum(days)}</strong></div>
        <div className="card stat"><span className="muted small">اولین رویداد</span><strong style={{ fontSize: '1rem' }}>{fmt(dates[0])}</strong></div>
        <div className="card stat"><span className="muted small">آخرین رویداد</span><strong style={{ fontSize: '1rem' }}>{fmt(dates.at(-1))}</strong></div>
      </div>
      <div className="dash-grid">
        <section className="card dash-card">
          <h3>رویدادها در هر ماه</h3>
          <Bars rows={months.map((m) => [m.label, m.n])} />
        </section>
        <section className="card dash-card">
          <h3>پرتکرارترین برچسب‌ها</h3>
          {tags.length === 0 ? <div className="muted">برچسبی ثبت نشده.</div> : <Bars rows={tags.slice(0, 15)} onClick={onTag} />}
        </section>
        <section className="card dash-card">
          <h3>رویدادها بر اساس روز هفته</h3>
          <Bars rows={WEEKDAYS.map((w, i) => [w, byWeekday[i]])} />
        </section>
      </div>
    </div>
  )
}

function Bars({ rows, onClick }: { rows: [string, number][]; onClick?: (label: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r[1]))
  return (
    <div className="col" style={{ gap: 6 }}>
      {rows.map(([label, n]) => (
        <div key={label} className="report-row" style={onClick ? { cursor: 'pointer' } : undefined} onClick={() => onClick?.(label)}>
          <span className="small report-label">{label}</span>
          <div className="report-bar grow"><div style={{ width: `${(n / max) * 100}%` }} /></div>
          <span className="small" style={{ width: 32, textAlign: 'left' }}>{faNum(n)}</span>
        </div>
      ))}
    </div>
  )
}

/** Appends dictated text to the stored body, so phrases arriving back to back don't overwrite each other. */
let appendQueue = Promise.resolve()
function appendBody(id: string, text: string) {
  appendQueue = appendQueue.then(async () => {
    const cur = (await db.journal.get(id))?.body ?? ''
    await update('journal', id, { body: cur ? `${cur} ${text}` : text })
  })
}

function EntryDialog({ id, suggestions, onClose }: { id: string; suggestions: string[]; onClose: () => void }) {
  const entries = useJournal()
  const e = entries.find((x) => x.id === id)
  const [interim, setInterim] = useState('')
  if (!e) return null
  const set = (c: Partial<JournalEntry>) => update('journal', e.id, c)
  const close = () => {
    // Drop entries that were opened and left completely empty.
    if (!e.title.trim() && !e.body.trim() && !e.tags.length) remove('journal', e.id)
    onClose()
  }

  return (
    <Modal
      wide
      title="رویداد"
      onClose={close}
      footer={
        <>
          <button className="btn primary" onClick={close}>ذخیره</button>
          <div className="spacer" />
          <button className="btn danger" onClick={() => { remove('journal', e.id); onClose() }}>حذف</button>
        </>
      }
    >
      <div className="grid2">
        <div className="field">
          <span>تاریخ</span>
          <DateInput value={e.date} onChange={(v) => v && set({ date: v })} />
        </div>
        <div className="field">
          <span>معادل</span>
          <div className="row" style={{ height: 36 }}>
            <span>شمسی: {jalali(e.date)}</span>
            <span className="muted">|</span>
            <span>میلادی: <span dir="ltr">{gregorian(e.date)}</span></span>
          </div>
        </div>
      </div>
      <label className="field">
        <span>عنوان / موضوع</span>
        <input autoFocus className="input" value={e.title} onChange={(ev) => set({ title: ev.target.value })} />
      </label>
      <div className="field">
        <div className="row"><span className="grow small muted">شرح رویداد</span><VoiceButton onInterim={setInterim} onText={(t) => appendBody(e.id, t)} /></div>
        <textarea className="input" style={{ minHeight: 180 }} value={e.body} onChange={(ev) => set({ body: ev.target.value })} />
        {interim && <div className="small muted">… {interim}</div>}
      </div>
      <div className="field">
        <span>برچسب‌ها</span>
        <TagInput value={e.tags} onChange={(tags) => set({ tags })} suggestions={suggestions} />
      </div>
    </Modal>
  )
}
