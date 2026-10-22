import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCustomerRecords, useCustomers } from '../lib/hooks'
import { create, update, type Lead, type LeadStage } from '../lib/db'
import { balance, forecast, STAGES } from '../lib/crm'
import { faMoney, faNum, fmt } from '../lib/date'

type Tab = 'list' | 'leads' | 'forecast'

export default function Customers() {
  const customers = useCustomers()
  const { finances, leads } = useCustomerRecords()
  const [tab, setTab] = useState<Tab>('list')
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const list = customers.filter((c) => !q || [c.name, c.company, c.phone, c.email].some((f) => f.includes(q)))

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="grow">مشتریان</h1>
        <button
          className="btn primary"
          onClick={async () => {
            const c = await create('customers', { name: 'مشتری جدید', company: '', phone: '', email: '', address: '', notes: '', tags: [] })
            nav(`/customers/${c.id}`)
          }}
        >
          مشتری جدید
        </button>
      </div>
      <div className="tabs">
        {(['list', 'leads', 'forecast'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {{ list: 'فهرست مشتریان', leads: 'فرصت‌های فروش', forecast: 'پیش‌بینی درآمد' }[t]}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <>
          <input className="input" style={{ maxWidth: 320 }} placeholder="جستجو در نام، شرکت، تلفن…" value={q} onChange={(e) => setQ(e.target.value)} />
          {list.length === 0 ? (
            <div className="empty">مشتری‌ای نیست.</div>
          ) : (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead><tr><th>نام</th><th>شرکت</th><th>تلفن</th><th>فرصت‌های باز</th><th>مانده حساب</th></tr></thead>
                <tbody>
                  {list.map((c) => {
                    const bal = balance(finances.filter((f) => f.customerId === c.id))
                    return (
                      <tr key={c.id}>
                        <td><Link to={`/customers/${c.id}`}>{c.name}</Link></td>
                        <td>{c.company}</td>
                        <td dir="ltr" style={{ textAlign: 'right' }}>{faNum(c.phone)}</td>
                        <td>{faNum(leads.filter((l) => l.customerId === c.id && !['won', 'lost'].includes(l.stage)).length)}</td>
                        <td style={{ color: bal > 0 ? 'var(--danger)' : undefined }}>{faMoney(bal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'leads' && <Pipeline leads={leads} customerName={(id) => customers.find((c) => c.id === id)?.name ?? ''} />}
      {tab === 'forecast' && <Forecast />}
    </div>
  )
}

export function Pipeline({ leads, customerName }: { leads: Lead[]; customerName?: (id: string) => string }) {
  return (
    <div className="board" style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
      {STAGES.map((s) => {
        const items = leads.filter((l) => l.stage === s.key)
        return (
          <div
            key={s.key}
            className="column"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('text/lead')
              if (!id) return
              const changes: Partial<Lead> = { stage: s.key as LeadStage }
              if (s.key === 'won') changes.probability = 100
              if (s.key === 'lost') changes.probability = 0
              update('leads', id, changes)
            }}
          >
            <div className="row"><strong className="grow">{s.label}</strong><span className="small muted">{faMoney(items.reduce((a, l) => a + l.amount, 0))}</span></div>
            {items.map((l) => (
              <Link key={l.id} to={`/customers/${l.customerId}`} draggable onDragStart={(e) => e.dataTransfer.setData('text/lead', l.id)} className="card task-card" style={{ color: 'inherit' }}>
                <div>{l.title}</div>
                <div className="row wrap small">
                  {customerName && <span className="chip">{customerName(l.customerId)}</span>}
                  <span className="chip">{faMoney(l.amount)}</span>
                  <span className="chip">{faNum(l.probability)}٪</span>
                  {l.expectedDate && <span className="chip">{fmt(l.expectedDate, 'd MMMM')}</span>}
                </div>
              </Link>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function Forecast() {
  const { finances, leads } = useCustomerRecords()
  const data = forecast(finances, leads)
  const max = Math.max(1, ...data.map((d) => d.invoices + d.leads))
  const total = data.reduce((s, d) => s + d.invoices + d.leads, 0)
  return (
    <div className="col" style={{ maxWidth: 760 }}>
      <div className="muted small">جمع فاکتورهای پرداخت‌نشده بر اساس تاریخ، به‌علاوه‌ی مبلغ فرصت‌های فروش باز ضرب در احتمال موفقیت، بر اساس تاریخ پیش‌بینی‌شده.</div>
      <div className="card" style={{ padding: 16 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <strong className="grow">درآمد پیش‌بینی‌شده‌ی ۶ ماه آینده</strong>
          <strong>{faMoney(total)}</strong>
        </div>
        {data.map((d) => (
          <div key={d.label} className="forecast-row">
            <span className="small" style={{ width: 100 }}>{d.label}</span>
            <div className="forecast-bar grow">
              <div style={{ width: `${(d.invoices / max) * 100}%`, background: 'var(--primary)' }} title="فاکتورهای پرداخت‌نشده" />
              <div style={{ width: `${(d.leads / max) * 100}%`, background: 'var(--primary)', opacity: 0.4 }} title="فرصت‌های فروش" />
            </div>
            <span className="small" style={{ width: 120, textAlign: 'left' }}>{faMoney(d.invoices + d.leads)}</span>
          </div>
        ))}
        <div className="row small muted" style={{ marginTop: 8 }}>
          <span className="dot" style={{ background: 'var(--primary)' }} /> فاکتورهای پرداخت‌نشده
          <span className="dot" style={{ background: 'var(--primary)', opacity: 0.4, marginInlineStart: 12 }} /> فرصت‌های فروش (وزن‌دار)
        </div>
      </div>
    </div>
  )
}
