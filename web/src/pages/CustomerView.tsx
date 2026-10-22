import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, create, remove, update, type ContactKind, type Customer, type FinanceKind, type LeadStage } from '../lib/db'
import { useCustomerRecords, useProjects, useTasks } from '../lib/hooks'
import { balance, CONTACT_KINDS, FINANCE_KINDS, STAGES } from '../lib/crm'
import { faMoney, faNum, fmt, todayISO } from '../lib/date'
import { addTask, completeTask, reopenTask } from '../lib/tasks'
import { ensureInbox } from '../lib/seed'
import DateInput from '../components/DateInput'
import TaskCard from '../components/TaskCard'
import TaskDialog from '../components/TaskDialog'
import QuickAdd from '../components/QuickAdd'

type Tab = 'info' | 'contacts' | 'finance' | 'leads' | 'tasks'

export default function CustomerView() {
  const { id } = useParams()
  const nav = useNavigate()
  const customer = useLiveQuery(() => (id ? db.customers.get(id) : undefined), [id])
  const { contacts, finances, leads } = useCustomerRecords(id)
  const tasks = useTasks().filter((t) => t.customerId === id)
  const projects = useProjects()
  const [tab, setTab] = useState<Tab>('info')
  const [openTask, setOpenTask] = useState<string>()

  if (customer === undefined) return null
  if (!customer || customer.deleted) return <div className="empty">مشتری پیدا نشد. <Link to="/customers">بازگشت</Link></div>
  const set = (c: Partial<Customer>) => update('customers', customer.id, c)
  const bal = balance(finances)
  const openTasks = tasks.filter((t) => !t.done).length

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div className="page-head">
        <Link to="/customers" className="btn ghost">→</Link>
        <input className="title-input grow" value={customer.name} onChange={(e) => set({ name: e.target.value })} />
        <span className="chip">مانده: {faMoney(bal)}</span>
      </div>
      <div className="tabs" style={{ overflowX: 'auto' }}>
        {(
          [
            ['info', 'اطلاعات'],
            ['contacts', `گزارش تماس (${faNum(contacts.length)})`],
            ['finance', `اسناد مالی (${faNum(finances.length)})`],
            ['leads', `فرصت‌های فروش (${faNum(leads.length)})`],
            ['tasks', `پیگیری‌ها (${faNum(openTasks)})`],
          ] as [Tab, string][]
        ).map(([k, v]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{v}</button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="col">
          <div className="grid2">
            <label className="field"><span>شرکت</span><input className="input" value={customer.company} onChange={(e) => set({ company: e.target.value })} /></label>
            <label className="field"><span>تلفن</span><input className="input" dir="ltr" value={customer.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
            <label className="field"><span>ایمیل</span><input className="input" dir="ltr" value={customer.email} onChange={(e) => set({ email: e.target.value })} /></label>
            <label className="field"><span>آدرس</span><input className="input" value={customer.address} onChange={(e) => set({ address: e.target.value })} /></label>
          </div>
          <label className="field"><span>توضیحات</span><textarea className="input" value={customer.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
          <div><button className="btn danger" onClick={() => { if (confirm('این مشتری حذف شود؟')) { remove('customers', customer.id); nav('/customers') } }}>حذف مشتری</button></div>
        </div>
      )}

      {tab === 'contacts' && (
        <div className="col">
          <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => create('contacts', { customerId: customer.id, date: todayISO(), kind: 'call', summary: '' })}>+ گزارش تماس</button>
          {[...contacts].sort((a, b) => b.date.localeCompare(a.date)).map((c) => (
            <div key={c.id} className="card col" style={{ padding: 12 }}>
              <div className="row wrap">
                <div style={{ width: 220 }}><DateInput value={c.date} onChange={(v) => v && update('contacts', c.id, { date: v })} /></div>
                <select className="input" style={{ width: 140 }} value={c.kind} onChange={(e) => update('contacts', c.id, { kind: e.target.value as ContactKind })}>
                  {Object.entries(CONTACT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <div className="spacer" />
                <button className="btn ghost sm danger" onClick={() => remove('contacts', c.id)}>حذف</button>
              </div>
              <textarea className="input" placeholder="خلاصه‌ی گفتگو…" value={c.summary} onChange={(e) => update('contacts', c.id, { summary: e.target.value })} />
            </div>
          ))}
        </div>
      )}

      {tab === 'finance' && (
        <div className="col">
          <div className="row">
            <button className="btn primary" onClick={() => create('finances', { customerId: customer.id, date: todayISO(), kind: 'invoice', title: '', amount: 0, paid: false })}>+ سند مالی</button>
            <span className="spacer" />
            <span className="small muted">جمع فاکتورها: {faMoney(finances.filter((f) => f.kind === 'invoice').reduce((s, f) => s + f.amount, 0))}</span>
          </div>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>تاریخ</th><th>نوع</th><th>شرح</th><th>مبلغ (تومان)</th><th>پرداخت‌شده</th><th /></tr></thead>
              <tbody>
                {[...finances].sort((a, b) => b.date.localeCompare(a.date)).map((f) => (
                  <tr key={f.id}>
                    <td style={{ minWidth: 200 }}><DateInput value={f.date} onChange={(v) => v && update('finances', f.id, { date: v })} /></td>
                    <td>
                      <select className="input" value={f.kind} onChange={(e) => update('finances', f.id, { kind: e.target.value as FinanceKind })}>
                        {Object.entries(FINANCE_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td><input className="input" value={f.title} onChange={(e) => update('finances', f.id, { title: e.target.value })} /></td>
                    <td><AmountInput value={f.amount} onChange={(amount) => update('finances', f.id, { amount })} /></td>
                    <td>{f.kind === 'invoice' && <input type="checkbox" checked={f.paid} onChange={(e) => update('finances', f.id, { paid: e.target.checked })} />}</td>
                    <td><button className="btn ghost sm danger" onClick={() => remove('finances', f.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="col">
          <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => create('leads', { customerId: customer.id, title: 'فرصت جدید', amount: 0, probability: 50, stage: 'new' })}>+ فرصت فروش</button>
          {leads.map((l) => (
            <div key={l.id} className="card grid2" style={{ padding: 12 }}>
              <label className="field"><span>عنوان</span><input className="input" value={l.title} onChange={(e) => update('leads', l.id, { title: e.target.value })} /></label>
              <label className="field"><span>مرحله</span>
                <select className="input" value={l.stage} onChange={(e) => update('leads', l.id, { stage: e.target.value as LeadStage })}>
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
              <label className="field"><span>مبلغ (تومان)</span><AmountInput value={l.amount} onChange={(amount) => update('leads', l.id, { amount })} /></label>
              <label className="field"><span>احتمال موفقیت: {faNum(l.probability)}٪</span><input type="range" min={0} max={100} step={5} value={l.probability} onChange={(e) => update('leads', l.id, { probability: Number(e.target.value) })} /></label>
              <div className="field"><span>تاریخ پیش‌بینی‌شده‌ی بستن</span><DateInput value={l.expectedDate} onChange={(v) => update('leads', l.id, { expectedDate: v })} /></div>
              <div className="row" style={{ alignSelf: 'end' }}><span className="spacer" /><button className="btn ghost sm danger" onClick={() => remove('leads', l.id)}>حذف</button></div>
            </div>
          ))}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="col">
          <QuickAdd placeholder="+ پیگیری جدید (مثلاً: تماس دوباره)" onAdd={async (title) => addTask(await ensureInbox(), title, undefined, { customerId: customer.id, dueDate: todayISO() })} />
          {[...tasks].sort((a, b) => Number(a.done) - Number(b.done)).map((t) => {
            const p = projects.find((x) => x.id === t.projectId)
            return <TaskCard key={t.id} task={t} projectName={p?.name} onOpen={() => setOpenTask(t.id)} onToggle={() => p && (t.done ? reopenTask(t, p) : completeTask(t, p))} />
          })}
          {tasks.length === 0 && <div className="empty">پیگیری‌ای ثبت نشده. هر وظیفه‌ای که به این مشتری وصل شود اینجا می‌آید.</div>}
        </div>
      )}
      {openTask && <TaskDialog taskId={openTask} onClose={() => setOpenTask(undefined)} />}
      <div className="small muted">آخرین تماس: {contacts.length ? fmt([...contacts].sort((a, b) => b.date.localeCompare(a.date))[0].date) : '—'}</div>
    </div>
  )
}

function AmountInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const toLatin = (s: string) => s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\d]/g, '')
  return (
    <input
      className="input"
      inputMode="numeric"
      dir="ltr"
      value={value ? faMoney(value) : ''}
      placeholder="۰"
      onChange={(e) => onChange(Number(toLatin(e.target.value)) || 0)}
    />
  )
}
