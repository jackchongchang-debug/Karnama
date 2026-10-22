import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  getDate,
  getDay,
  getMonth,
  getYear,
  newDate,
  startOfMonth,
  endOfMonth,
} from 'date-fns-jalali'
import { faIR } from 'date-fns-jalali/locale'
import type { Recurrence } from './db'

export const MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]
export const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']

const pad = (n: number) => String(n).padStart(2, '0')

/** Dates are stored as Gregorian ISO day strings so they sort and sync cleanly. */
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISO(new Date())
}

export function faNum(v: string | number): string {
  return String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}

export function faMoney(n: number): string {
  return faNum(Math.round(n).toLocaleString('en-US')).replace(/,/g, '٬')
}

export function fmt(iso: string | undefined, pattern = 'd MMMM yyyy'): string {
  if (!iso) return ''
  return faNum(format(fromISO(iso), pattern, { locale: faIR }))
}

export function fmtDateTime(iso: string | undefined): string {
  if (!iso) return ''
  return faNum(format(new Date(iso), 'd MMMM yyyy، HH:mm', { locale: faIR }))
}

export function jParts(d: Date) {
  return { y: getYear(d), m: getMonth(d), d: getDate(d) }
}

export function jDate(y: number, m: number, d: number): Date {
  return newDate(y, m, d)
}

/** Saturday-first weekday index (0 = شنبه … 6 = جمعه). */
export function weekdayIndex(d: Date): number {
  return (getDay(d) + 1) % 7
}

/** Cells for a Jalali month view: leading nulls then each day of the month. */
export function monthCells(y: number, m: number): (Date | null)[] {
  const first = startOfMonth(jDate(y, m, 1))
  const last = endOfMonth(first)
  const cells: (Date | null)[] = Array(weekdayIndex(first)).fill(null)
  for (let d = first; d <= last; d = addDays(d, 1)) cells.push(d)
  while (cells.length % 7) cells.push(null)
  return cells
}

export function shiftMonth(y: number, m: number, delta: number) {
  const d = addMonths(jDate(y, m, 1), delta)
  return { y: getYear(d), m: getMonth(d) }
}

export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(fromISO(b), fromISO(a))
}

export function addDaysISO(iso: string, n: number): string {
  return toISO(addDays(fromISO(iso), n))
}

export function nextOccurrence(iso: string, r: Recurrence): string {
  const d = fromISO(iso)
  const n = Math.max(1, r.interval)
  const next =
    r.freq === 'daily' ? addDays(d, n)
    : r.freq === 'weekly' ? addWeeks(d, n)
    : r.freq === 'monthly' ? addMonths(d, n)
    : addYears(d, n)
  return toISO(next)
}

/** Official holidays fixed on the solar calendar, keyed by `month-day` (1-based). */
const FIXED_HOLIDAYS: Record<string, string> = {
  '1-1': 'عید نوروز',
  '1-2': 'عید نوروز',
  '1-3': 'عید نوروز',
  '1-4': 'عید نوروز',
  '1-12': 'روز جمهوری اسلامی',
  '1-13': 'روز طبیعت',
  '3-14': 'رحلت امام خمینی',
  '3-15': 'قیام ۱۵ خرداد',
  '11-22': 'پیروزی انقلاب اسلامی',
  '12-29': 'ملی شدن صنعت نفت',
}

export function fixedHoliday(d: Date): string | undefined {
  return FIXED_HOLIDAYS[`${getMonth(d) + 1}-${getDate(d)}`]
}

export const FREQ_LABEL: Record<Recurrence['freq'], string> = {
  daily: 'روز',
  weekly: 'هفته',
  monthly: 'ماه',
  yearly: 'سال',
}

/** The current Jalali month and the ones after it, as Gregorian ISO ranges. */
export function addMonthsJalali(count: number) {
  const now = jParts(new Date())
  return Array.from({ length: count }, (_, i) => {
    const { y, m } = shiftMonth(now.y, now.m, i)
    const first = jDate(y, m, 1)
    return { label: `${MONTHS[m]} ${faNum(y)}`, from: toISO(first), to: toISO(endOfMonth(first)) }
  })
}
