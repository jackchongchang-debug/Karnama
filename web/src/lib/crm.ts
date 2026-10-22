import type { ContactKind, FinanceDoc, FinanceKind, Lead, LeadStage } from './db'
import { addMonthsJalali } from './date'

export const STAGES: { key: LeadStage; label: string }[] = [
  { key: 'new', label: 'جدید' },
  { key: 'qualified', label: 'واجد شرایط' },
  { key: 'proposal', label: 'ارسال پیشنهاد' },
  { key: 'negotiation', label: 'مذاکره' },
  { key: 'won', label: 'موفق' },
  { key: 'lost', label: 'ناموفق' },
]

export const CONTACT_KINDS: Record<ContactKind, string> = {
  call: 'تماس تلفنی',
  meeting: 'جلسه',
  email: 'ایمیل',
  message: 'پیام',
  other: 'سایر',
}

export const FINANCE_KINDS: Record<FinanceKind, string> = {
  invoice: 'فاکتور',
  payment: 'دریافتی',
  expense: 'هزینه',
}

/** Customer balance: invoiced minus received (positive means the customer owes). */
export function balance(docs: FinanceDoc[]) {
  return docs.reduce((s, d) => s + (d.kind === 'invoice' ? d.amount : d.kind === 'payment' ? -d.amount : 0), 0)
}

/**
 * Expected income per Jalali month for the coming months: unpaid invoices by their date,
 * plus open sales opportunities weighted by their probability at their expected close date.
 */
export function forecast(docs: FinanceDoc[], leads: Lead[], months = 6) {
  const buckets = addMonthsJalali(months).map((b) => ({ ...b, invoices: 0, leads: 0, received: 0 }))
  const find = (iso?: string) => (iso ? buckets.find((b) => iso >= b.from && iso <= b.to) : undefined)
  for (const d of docs) {
    const b = find(d.date)
    if (!b) continue
    if (d.kind === 'invoice' && !d.paid) b.invoices += d.amount
    if (d.kind === 'payment') b.received += d.amount
  }
  for (const l of leads) {
    if (l.stage === 'won' || l.stage === 'lost') continue
    const b = find(l.expectedDate)
    if (b) b.leads += (l.amount * l.probability) / 100
  }
  return buckets
}
