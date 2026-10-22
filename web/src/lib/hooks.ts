import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

const alive = <T extends { deleted: 0 | 1 }>(rows: T[]) => rows.filter((r) => !r.deleted)

export function useProjects() {
  return useLiveQuery(async () => alive(await db.projects.toArray()).sort((a, b) => a.order - b.order), []) ?? []
}

export function useProject(id?: string) {
  return useLiveQuery(async () => (id ? db.projects.get(id) : undefined), [id])
}

export function useTasks(projectId?: string) {
  return (
    useLiveQuery(
      async () => alive(projectId ? await db.tasks.where('projectId').equals(projectId).toArray() : await db.tasks.toArray()),
      [projectId],
    ) ?? []
  )
}

export function useLabels() {
  return useLiveQuery(async () => alive(await db.labels.toArray()), []) ?? []
}

export function useHolidays() {
  return useLiveQuery(async () => alive(await db.holidays.toArray()), []) ?? []
}

export function useNotes() {
  return useLiveQuery(async () => alive(await db.notes.toArray()).sort((a, b) => b.updatedAt - a.updatedAt), []) ?? []
}

export function useCustomers() {
  return useLiveQuery(async () => alive(await db.customers.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'fa')), []) ?? []
}

export function useCustomerRecords(customerId?: string) {
  return useLiveQuery(async () => {
    const q = <T extends { deleted: 0 | 1; customerId: string }>(rows: T[]) =>
      alive(rows).filter((r) => !customerId || r.customerId === customerId)
    return {
      contacts: q(await db.contacts.toArray()),
      finances: q(await db.finances.toArray()),
      leads: q(await db.leads.toArray()),
    }
  }, [customerId]) ?? { contacts: [], finances: [], leads: [] }
}

export function useTemplates() {
  return useLiveQuery(async () => alive(await db.templates.toArray()), []) ?? []
}
