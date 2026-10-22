import Dexie, { type Table } from 'dexie'

// Every synced record carries an id, a last-modified time and a soft-delete flag,
// so the sync server can merge changes from several devices (last write wins).
export interface Base {
  id: string
  updatedAt: number
  deleted: 0 | 1
}

export interface Column {
  id: string
  title: string
}

export interface Project extends Base {
  name: string
  description: string
  color: string
  columns: Column[]
  archived: boolean
  order: number
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Recurrence {
  freq: Frequency
  interval: number
}

export interface Task extends Base {
  projectId: string
  columnId: string
  title: string
  description: string
  order: number
  done: boolean
  completedAt?: number
  startDate?: string // ISO yyyy-MM-dd (Gregorian)
  endDate?: string
  dueDate?: string
  reminderAt?: string // ISO datetime
  weight: number
  labels: string[]
  checklist: ChecklistItem[]
  recurrence?: Recurrence
  customerId?: string
}

export interface Note extends Base {
  title: string
  body: string
  color: string
  pinned: boolean
}

export interface Customer extends Base {
  name: string
  company: string
  phone: string
  email: string
  address: string
  notes: string
  tags: string[]
}

export type ContactKind = 'call' | 'meeting' | 'email' | 'message' | 'other'

export interface ContactReport extends Base {
  customerId: string
  date: string
  kind: ContactKind
  summary: string
}

export type FinanceKind = 'invoice' | 'payment' | 'expense'

export interface FinanceDoc extends Base {
  customerId: string
  date: string
  kind: FinanceKind
  title: string
  amount: number
  paid: boolean
}

export type LeadStage = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'

export interface Lead extends Base {
  customerId: string
  title: string
  amount: number
  probability: number
  stage: LeadStage
  expectedDate?: string
}

export interface TemplateStep {
  title: string
  description: string
  offsetDays: number
  durationDays: number
  weight: number
  labels: string[]
  checklist: string[]
}

export interface Template extends Base {
  name: string
  description: string
  steps: TemplateStep[]
}

export interface Label extends Base {
  name: string
  color: string
}

export interface Holiday extends Base {
  date: string
  title: string
}

export interface Meta {
  key: string
  value: unknown
}

class AppDB extends Dexie {
  projects!: Table<Project, string>
  tasks!: Table<Task, string>
  notes!: Table<Note, string>
  customers!: Table<Customer, string>
  contacts!: Table<ContactReport, string>
  finances!: Table<FinanceDoc, string>
  leads!: Table<Lead, string>
  templates!: Table<Template, string>
  labels!: Table<Label, string>
  holidays!: Table<Holiday, string>
  meta!: Table<Meta, string>

  constructor() {
    super('karnama')
    this.version(1).stores({
      projects: 'id, updatedAt, deleted, order',
      tasks: 'id, updatedAt, deleted, projectId, customerId, dueDate, startDate',
      notes: 'id, updatedAt, deleted',
      customers: 'id, updatedAt, deleted, name',
      contacts: 'id, updatedAt, deleted, customerId',
      finances: 'id, updatedAt, deleted, customerId',
      leads: 'id, updatedAt, deleted, customerId',
      templates: 'id, updatedAt, deleted',
      labels: 'id, updatedAt, deleted',
      holidays: 'id, updatedAt, deleted, date',
      meta: 'key',
    })
  }
}

export const db = new AppDB()

export const SYNCED_TABLES = [
  'projects',
  'tasks',
  'notes',
  'customers',
  'contacts',
  'finances',
  'leads',
  'templates',
  'labels',
  'holidays',
] as const

export type SyncedTable = (typeof SYNCED_TABLES)[number]

const listeners = new Set<() => void>()

/** Called after every local write, so the sync client can push soon after. */
export function onLocalChange(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const changed = () => listeners.forEach((fn) => fn())

export function uid(): string {
  return crypto.randomUUID()
}

type Row<K extends SyncedTable> = AppDB[K] extends Table<infer T, string> ? T : never
type NewRow<K extends SyncedTable> = Omit<Row<K>, 'id' | 'updatedAt' | 'deleted'> & { id?: string }

export async function create<K extends SyncedTable>(table: K, data: NewRow<K>): Promise<Row<K>> {
  const row = { ...data, id: data.id ?? uid(), updatedAt: Date.now(), deleted: 0 } as Row<K>
  await (db[table] as unknown as Table<Row<K>, string>).put(row)
  changed()
  return row
}

export async function update<K extends SyncedTable>(table: K, id: string, changes: Partial<Row<K>>) {
  await (db[table] as unknown as Table<Row<K>, string>).update(id, { ...changes, updatedAt: Date.now() } as never)
  changed()
}

export async function remove(table: SyncedTable, id: string) {
  await update(table, id, { deleted: 1 } as never)
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return row ? (row.value as T) : fallback
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value })
}
