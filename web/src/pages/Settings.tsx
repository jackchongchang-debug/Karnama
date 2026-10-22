import { useRef, useState } from 'react'
import { useHolidays, useLabels } from '../lib/hooks'
import { create, remove, update } from '../lib/db'
import { download, exportBackup, importBackup, importCSV, importTrello } from '../lib/importers'
import { login, logout, syncNow, useSyncState } from '../lib/sync'
import { faNum, fmt, fmtDateTime, todayISO } from '../lib/date'
import DateInput from '../components/DateInput'
import { useLiveQuery } from 'dexie-react-hooks'
import { getConfig } from '../lib/sync'

export default function Settings() {
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <h1>تنظیمات</h1>
      <SyncSection />
      <NotificationSection />
      <ImportSection />
      <LabelsSection />
      <HolidaysSection />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card col" style={{ padding: 16, gap: 12 }}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function SyncSection() {
  const s = useSyncState()
  const cfg = useLiveQuery(getConfig, [s.configured, s.lastSync])
  const [url, setUrl] = useState(location.origin)
  const [password, setPassword] = useState('')
  const [device, setDevice] = useState(/Mobi/.test(navigator.userAgent) ? 'گوشی' : 'کامپیوتر')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (cfg)
    return (
      <Section title="همگام‌سازی بین دستگاه‌ها">
        <div>متصل به <span dir="ltr">{cfg.url}</span></div>
        <div className="small muted">
          {s.status === 'error' ? <span style={{ color: 'var(--danger)' }}>{s.error}</span> : s.lastSync ? `آخرین همگام‌سازی: ${fmtDateTime(new Date(s.lastSync).toISOString())}` : ''}
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => syncNow()} disabled={s.status === 'syncing'}>همگام‌سازی الان</button>
          <button className="btn" onClick={logout}>قطع اتصال این دستگاه</button>
        </div>
      </Section>
    )

  return (
    <Section title="همگام‌سازی بین دستگاه‌ها">
      <div className="small muted">با وارد کردن آدرس سرور و رمز عبور، اطلاعات این دستگاه با بقیه‌ی دستگاه‌هایتان یکی می‌شود. بدون اتصال هم برنامه کامل کار می‌کند.</div>
      <form
        className="col"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setErr('')
          try {
            await login(url, password, device)
          } catch (e) {
            setErr(e instanceof Error ? e.message : String(e))
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="grid2">
          <label className="field"><span>آدرس سرور</span><input className="input" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
          <label className="field"><span>نام این دستگاه</span><input className="input" value={device} onChange={(e) => setDevice(e.target.value)} /></label>
          <label className="field"><span>رمز عبور</span><input className="input" type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        </div>
        {err && <div style={{ color: 'var(--danger)' }}>{err}</div>}
        <div><button className="btn primary" disabled={busy || !password}>اتصال</button></div>
      </form>
    </Section>
  )
}

function NotificationSection() {
  const supported = 'Notification' in window
  const [perm, setPerm] = useState(supported ? Notification.permission : 'denied')
  return (
    <Section title="اعلان یادآورها">
      <div className="small muted">یادآورها وقتی برنامه باز است (یا در پس‌زمینه‌ی مرورگر است) نمایش داده می‌شوند.</div>
      {!supported ? (
        <div className="muted">این مرورگر از اعلان پشتیبانی نمی‌کند.</div>
      ) : perm === 'granted' ? (
        <div style={{ color: 'var(--success)' }}>اعلان‌ها فعال است.</div>
      ) : (
        <div><button className="btn" onClick={async () => setPerm(await Notification.requestPermission())}>فعال کردن اعلان‌ها</button>{perm === 'denied' && <span className="small muted"> (در تنظیمات مرورگر مسدود شده است)</span>}</div>
      )}
    </Section>
  )
}

function ImportSection() {
  const [msg, setMsg] = useState('')
  const csv = useRef<HTMLInputElement>(null)
  const trello = useRef<HTMLInputElement>(null)
  const backup = useRef<HTMLInputElement>(null)
  const run = async (input: HTMLInputElement | null, fn: (text: string, name: string) => Promise<string>) => {
    const file = input?.files?.[0]
    if (!file) return
    try {
      setMsg(await fn(await file.text(), file.name))
    } catch (e) {
      setMsg(`خطا: ${e instanceof Error ? e.message : String(e)}`)
    }
    input.value = ''
  }
  return (
    <Section title="پشتیبان‌گیری و ورود اطلاعات">
      <div className="row wrap">
        <button className="btn" onClick={async () => download(`karnama-backup-${todayISO()}.json`, await exportBackup())}>دریافت فایل پشتیبان</button>
        <button className="btn" onClick={() => backup.current?.click()}>بازگردانی از پشتیبان</button>
        <button className="btn" onClick={() => trello.current?.click()}>ورود از ترلو (JSON)</button>
        <button className="btn" onClick={() => csv.current?.click()}>ورود از اکسل / CSV</button>
      </div>
      <div className="small muted">
        ترلو: در برد، Menu ← Print, export and share ← Export as JSON. اکسل: فایل را با Save As به‌صورت CSV UTF-8 ذخیره کنید. سطر اول باید عنوان ستون‌ها باشد؛ ستون‌های قابل‌قبول: عنوان، توضیحات، پروژه، ددلاین، شروع، پایان، برچسب، وضعیت (یا معادل انگلیسی title, description, project, due, start, end, labels, done). تاریخ‌ها میلادی باشند.
      </div>
      {msg && <div>{msg}</div>}
      <input ref={backup} type="file" accept=".json" hidden onChange={(e) => run(e.target, async (t) => `${faNum(await importBackup(t))} مورد بازگردانی شد.`)} />
      <input ref={trello} type="file" accept=".json" hidden onChange={(e) => run(e.target, async (t) => { const r = await importTrello(t); return `پروژه‌ی «${r.project.name}» با ${faNum(r.count)} وظیفه ساخته شد.` })} />
      <input ref={csv} type="file" accept=".csv,.txt,.tsv" hidden onChange={(e) => run(e.target, async (t, name) => `${faNum(await importCSV(t, name.replace(/\.\w+$/, '')))} وظیفه وارد شد.`)} />
    </Section>
  )
}

function LabelsSection() {
  const labels = useLabels()
  const [name, setName] = useState('')
  return (
    <Section title="برچسب‌ها">
      {labels.map((l) => (
        <div key={l.id} className="row">
          <input type="color" value={l.color} onChange={(e) => update('labels', l.id, { color: e.target.value })} />
          <input className="input grow" value={l.name} onChange={(e) => update('labels', l.id, { name: e.target.value })} />
          <button className="btn ghost sm danger" onClick={() => remove('labels', l.id)}>حذف</button>
        </div>
      ))}
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { create('labels', { name: name.trim(), color: '#4f46e5' }); setName('') } }}>
        <input className="input grow" placeholder="برچسب جدید" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn">افزودن</button>
      </form>
    </Section>
  )
}

function HolidaysSection() {
  const holidays = useHolidays().sort((a, b) => a.date.localeCompare(b.date))
  const [date, setDate] = useState<string>()
  const [title, setTitle] = useState('')
  return (
    <Section title="تعطیلات">
      <div className="small muted">جمعه‌ها و تعطیلات رسمی خورشیدی (نوروز، ۱۲ و ۱۳ فروردین، ۱۴ و ۱۵ خرداد، ۲۲ بهمن، ۲۹ اسفند) خودکار در تقویم نمایش داده می‌شوند. تعطیلات قمری هر سال جابه‌جا می‌شوند؛ آن‌ها را اینجا اضافه کنید.</div>
      {holidays.map((h) => (
        <div key={h.id} className="row">
          <span style={{ width: 160 }}>{fmt(h.date)}</span>
          <span className="grow">{h.title}</span>
          <button className="btn ghost sm danger" onClick={() => remove('holidays', h.id)}>حذف</button>
        </div>
      ))}
      <form className="row wrap" onSubmit={(e) => { e.preventDefault(); if (date && title.trim()) { create('holidays', { date, title: title.trim() }); setTitle('') } }}>
        <div style={{ width: 230 }}><DateInput value={date} onChange={setDate} /></div>
        <input className="input grow" placeholder="مناسبت" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn">افزودن</button>
      </form>
    </Section>
  )
}
