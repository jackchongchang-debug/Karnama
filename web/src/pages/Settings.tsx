import { useRef, useState } from 'react'
import { useHolidays, useLabels } from '../lib/hooks'
import { create, remove, update } from '../lib/db'
import { download, exportBackup, importBackup, importCSV, importTrello } from '../lib/importers'
import { connect, DEFAULT_CLIENT_ID, disconnect, getConfig, reconnect, syncNow, useSyncState } from '../lib/sync'
import { faNum, fmt, fmtDateTime, todayISO } from '../lib/date'
import DateInput from '../components/DateInput'
import { useLiveQuery } from 'dexie-react-hooks'

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
  const cfg = useLiveQuery(getConfig, [s.configured, s.lastSync, s.status])
  const [clientId, setClientId] = useState(DEFAULT_CLIENT_ID)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setErr('')
    try {
      await fn()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (cfg?.enabled)
    return (
      <Section title="همگام‌سازی با گوگل‌درایو">
        <div>متصل به حساب <span dir="ltr">{cfg.email ?? 'گوگل'}</span></div>
        <div className="small muted">
          {s.status === 'error' ? <span style={{ color: 'var(--danger)' }}>{s.error}</span>
            : s.status === 'signin' ? <span style={{ color: 'var(--warning)' }}>ورود به گوگل منقضی شده؛ برای ادامه‌ی همگام‌سازی دوباره وارد شوید.</span>
            : s.lastSync ? `آخرین همگام‌سازی: ${fmtDateTime(new Date(s.lastSync).toISOString())}` : ''}
        </div>
        {err && <div style={{ color: 'var(--danger)' }}>{err}</div>}
        <div className="row wrap">
          {s.status === 'signin'
            ? <button className="btn primary" disabled={busy} onClick={() => run(reconnect)}>ورود دوباره</button>
            : <button className="btn primary" disabled={busy || s.status === 'syncing'} onClick={() => run(syncNow)}>همگام‌سازی الان</button>}
          <button className="btn" onClick={disconnect}>قطع اتصال این دستگاه</button>
        </div>
      </Section>
    )

  return (
    <Section title="همگام‌سازی با گوگل‌درایو">
      <div className="small muted">
        اطلاعات در یک پوشه‌ی مخفی مخصوص همین برنامه در گوگل‌درایو خودتان ذخیره می‌شود (به بقیه‌ی فایل‌های درایو دسترسی ندارد). روی هر دستگاه با همان حساب گوگل وارد شوید تا اطلاعات یکی شود. بدون اتصال هم برنامه کامل کار می‌کند.
      </div>
      {!DEFAULT_CLIENT_ID && (
        <label className="field">
          <span>شناسه‌ی کلاینت گوگل (Client ID)</span>
          <input className="input" dir="ltr" placeholder="xxxx.apps.googleusercontent.com" value={clientId} onChange={(e) => setClientId(e.target.value)} />
        </label>
      )}
      {err && <div style={{ color: 'var(--danger)' }}>{err}</div>}
      <div><button className="btn primary" disabled={busy || !clientId.trim()} onClick={() => run(() => connect(clientId))}>اتصال به گوگل‌درایو</button></div>
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
