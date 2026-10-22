import { db, create, update, uid, type Project, type Task, type Template } from './db'
import { addDaysISO, daysBetween, nextOccurrence, todayISO } from './date'

export const PROJECT_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#475569']

export function defaultColumns() {
  return [
    { id: uid(), title: 'برای انجام' },
    { id: uid(), title: 'در حال انجام' },
    { id: uid(), title: 'انجام شده' },
  ]
}

export function doneColumnId(p: Project) {
  return p.columns[p.columns.length - 1]?.id
}

export async function createProject(name: string, color = PROJECT_COLORS[0]) {
  const count = await db.projects.where('deleted').equals(0).count()
  return create('projects', { name, description: '', color, columns: defaultColumns(), archived: false, order: count })
}

export function blankTask(projectId: string, columnId: string, title: string): Omit<Task, 'id' | 'updatedAt' | 'deleted'> {
  return {
    projectId,
    columnId,
    title,
    description: '',
    order: Date.now(),
    done: false,
    weight: 1,
    labels: [],
    checklist: [],
  }
}

export async function addTask(project: Project, title: string, columnId = project.columns[0].id, extra: Partial<Task> = {}) {
  const isDone = columnId === doneColumnId(project)
  return create('tasks', {
    ...blankTask(project.id, columnId, title),
    done: isDone,
    completedAt: isDone ? Date.now() : undefined,
    ...extra,
  })
}

/** Moves a task to a column; the last column of a project means "done". */
export async function moveTask(task: Task, project: Project, columnId: string, order = Date.now()) {
  const done = columnId === doneColumnId(project)
  if (done && !task.done) return completeTask(task, project, columnId, order)
  await update('tasks', task.id, { columnId, order, done, completedAt: done ? task.completedAt : undefined })
}

/** Marks a task done; a recurring task spawns its next occurrence in the first column. */
export async function completeTask(task: Task, project: Project, columnId = doneColumnId(project), order = Date.now()) {
  await update('tasks', task.id, { done: true, completedAt: Date.now(), columnId, order })
  const r = task.recurrence
  const anchor = task.dueDate ?? task.startDate ?? task.endDate
  if (!r || !anchor) return
  const shift = daysBetween(anchor, nextOccurrence(anchor, r))
  const move = (d?: string) => (d ? addDaysISO(d, shift) : undefined)
  await create('tasks', {
    ...task,
    id: uid(),
    columnId: project.columns[0].id,
    order: Date.now(),
    done: false,
    completedAt: undefined,
    startDate: move(task.startDate),
    endDate: move(task.endDate),
    dueDate: move(task.dueDate),
    reminderAt: task.reminderAt ? new Date(new Date(task.reminderAt).getTime() + shift * 86400000).toISOString() : undefined,
    checklist: task.checklist.map((c) => ({ ...c, id: uid(), done: false })),
  })
  // Only the new occurrence repeats from here on.
  await update('tasks', task.id, { recurrence: undefined })
}

export async function reopenTask(task: Task, project: Project) {
  const col = task.columnId === doneColumnId(project) ? project.columns[0].id : task.columnId
  await update('tasks', task.id, { done: false, completedAt: undefined, columnId: col })
}

export async function duplicateTask(task: Task) {
  return create('tasks', {
    ...task,
    id: uid(),
    title: `${task.title} (کپی)`,
    order: Date.now(),
    checklist: task.checklist.map((c) => ({ ...c, id: uid() })),
  })
}

export async function duplicateProject(p: Project) {
  const columns = p.columns.map((c) => ({ ...c, id: uid() }))
  const colMap = new Map(p.columns.map((c, i) => [c.id, columns[i].id]))
  const copy = await create('projects', { ...p, id: uid(), name: `${p.name} (کپی)`, columns, order: Date.now() })
  const tasks = await db.tasks.where('projectId').equals(p.id).and((t) => !t.deleted).toArray()
  for (const t of tasks) {
    await create('tasks', {
      ...t,
      id: uid(),
      projectId: copy.id,
      columnId: colMap.get(t.columnId) ?? columns[0].id,
      checklist: t.checklist.map((c) => ({ ...c, id: uid() })),
    })
  }
  return copy
}

export async function applyTemplate(tpl: Template, project: Project, startISO: string) {
  for (const [i, s] of tpl.steps.entries()) {
    const start = addDaysISO(startISO, s.offsetDays)
    const end = addDaysISO(start, Math.max(0, s.durationDays - 1))
    await addTask(project, s.title, project.columns[0].id, {
      description: s.description,
      order: Date.now() + i,
      weight: s.weight,
      labels: s.labels,
      startDate: start,
      endDate: end,
      dueDate: end,
      checklist: s.checklist.map((text) => ({ id: uid(), text, done: false })),
    })
  }
}

export async function templateFromProject(p: Project, name: string) {
  const tasks = (await db.tasks.where('projectId').equals(p.id).and((t) => !t.deleted).toArray()).sort(
    (a, b) => (a.startDate ?? '9').localeCompare(b.startDate ?? '9') || a.order - b.order,
  )
  const base = tasks.find((t) => t.startDate)?.startDate
  return create('templates', {
    name,
    description: p.description,
    steps: tasks.map((t) => ({
      title: t.title,
      description: t.description,
      offsetDays: base && t.startDate ? daysBetween(base, t.startDate) : 0,
      durationDays: t.startDate && t.endDate ? daysBetween(t.startDate, t.endDate) + 1 : 1,
      weight: t.weight,
      labels: t.labels,
      checklist: t.checklist.map((c) => c.text),
    })),
  })
}

export function progress(tasks: Task[]) {
  const total = tasks.reduce((s, t) => s + (t.weight || 1), 0)
  const done = tasks.filter((t) => t.done).reduce((s, t) => s + (t.weight || 1), 0)
  return total ? Math.round((done / total) * 100) : 0
}

export function groupTasks(tasks: Task[]) {
  const today = todayISO()
  const week = addDaysISO(today, 7)
  const date = (t: Task) => t.dueDate ?? t.endDate ?? t.startDate
  const open = tasks.filter((t) => !t.done).sort((a, b) => (date(a) ?? '9').localeCompare(date(b) ?? '9'))
  return [
    { key: 'overdue', title: 'عقب‌افتاده', items: open.filter((t) => date(t) && date(t)! < today) },
    { key: 'today', title: 'امروز', items: open.filter((t) => date(t) === today) },
    { key: 'week', title: 'هفت روز آینده', items: open.filter((t) => date(t) && date(t)! > today && date(t)! <= week) },
    { key: 'later', title: 'بعداً', items: open.filter((t) => date(t) && date(t)! > week) },
    { key: 'none', title: 'بدون تاریخ', items: open.filter((t) => !date(t)) },
  ]
}
