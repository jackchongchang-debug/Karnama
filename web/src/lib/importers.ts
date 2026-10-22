import { db, create, SYNCED_TABLES, uid, type Project } from './db'
import { createProject, PROJECT_COLORS } from './tasks'
import { toISO } from './date'

/** RFC 4180-ish CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  text = text.replace(/^﻿/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',' || c === ';' || c === '\t') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((f) => f.trim()))
}

const HEADERS: Record<string, string[]> = {
  title: ['title', 'name', 'task', 'عنوان', 'نام', 'وظیفه'],
  description: ['description', 'desc', 'notes', 'توضیحات', 'شرح'],
  project: ['project', 'list', 'board', 'پروژه', 'لیست'],
  due: ['due', 'due date', 'deadline', 'ددلاین', 'مهلت', 'سررسید'],
  start: ['start', 'start date', 'شروع', 'تاریخ شروع'],
  end: ['end', 'end date', 'پایان', 'تاریخ پایان'],
  labels: ['labels', 'tags', 'برچسب', 'برچسب‌ها'],
  done: ['done', 'completed', 'status', 'انجام شده', 'وضعیت'],
}

/** Accepts Gregorian (2026-10-22, 10/22/2026) dates; returns ISO day or undefined. */
function parseDate(s: string): string | undefined {
  s = s.trim()
  if (!s) return undefined
  const d = new Date(s)
  return isNaN(d.getTime()) ? undefined : toISO(d)
}

const truthy = (s: string) => /^(1|true|yes|done|completed|بله|انجام|انجام شده)$/i.test(s.trim())

async function labelIds(names: string[]) {
  const existing = (await db.labels.toArray()).filter((l) => !l.deleted)
  const ids: string[] = []
  for (const raw of names) {
    const name = raw.trim()
    if (!name) continue
    let l = existing.find((x) => x.name === name)
    if (!l) {
      l = await create('labels', { name, color: PROJECT_COLORS[existing.length % PROJECT_COLORS.length] })
      existing.push(l)
    }
    ids.push(l.id)
  }
  return ids
}

export async function importCSV(text: string, fallbackProjectName: string) {
  const [head, ...rows] = parseCSV(text)
  if (!head) throw new Error('فایل خالی است')
  const idx = Object.fromEntries(
    Object.entries(HEADERS).map(([k, names]) => [k, head.findIndex((h) => names.includes(h.trim().toLowerCase()))]),
  ) as Record<keyof typeof HEADERS, number>
  if (idx.title < 0) throw new Error('ستون «عنوان» (title) در سطر اول پیدا نشد')

  const projects = new Map<string, Project>()
  const getProject = async (name: string) => {
    name = name.trim() || fallbackProjectName
    if (!projects.has(name)) {
      const found = (await db.projects.toArray()).find((p) => !p.deleted && p.name === name)
      projects.set(name, found ?? (await createProject(name, PROJECT_COLORS[projects.size % PROJECT_COLORS.length])))
    }
    return projects.get(name)!
  }
  const cell = (r: string[], k: keyof typeof HEADERS) => (idx[k] >= 0 ? (r[idx[k]] ?? '') : '')

  let count = 0
  for (const r of rows) {
    const title = cell(r, 'title').trim()
    if (!title) continue
    const p = await getProject(cell(r, 'project'))
    const done = truthy(cell(r, 'done'))
    await create('tasks', {
      projectId: p.id,
      columnId: done ? p.columns.at(-1)!.id : p.columns[0].id,
      title,
      description: cell(r, 'description'),
      order: Date.now() + count,
      done,
      completedAt: done ? Date.now() : undefined,
      dueDate: parseDate(cell(r, 'due')),
      startDate: parseDate(cell(r, 'start')),
      endDate: parseDate(cell(r, 'end')),
      weight: 1,
      labels: await labelIds(cell(r, 'labels').split(/[,،|]/)),
      checklist: [],
    })
    count++
  }
  return count
}

interface TrelloBoard {
  name: string
  desc?: string
  lists: { id: string; name: string; closed: boolean }[]
  cards: { id: string; name: string; desc: string; idList: string; closed: boolean; due: string | null; start?: string | null; dueComplete: boolean; idLabels: string[]; idChecklists: string[] }[]
  labels: { id: string; name: string; color: string | null }[]
  checklists: { id: string; checkItems: { name: string; state: string; pos: number }[] }[]
}

const TRELLO_COLORS: Record<string, string> = { green: '#059669', yellow: '#ca8a04', orange: '#d97706', red: '#dc2626', purple: '#7c3aed', blue: '#2563eb', sky: '#0891b2', lime: '#65a30d', pink: '#db2777', black: '#475569' }

/** Imports a Trello board export (Menu → Print, export and share → Export as JSON). */
export async function importTrello(text: string) {
  const board = JSON.parse(text) as TrelloBoard
  if (!board.lists || !board.cards) throw new Error('این فایل خروجی JSON ترلو نیست')
  const lists = board.lists.filter((l) => !l.closed)
  const columns = lists.map((l) => ({ id: uid(), title: l.name }))
  if (columns.length === 0) columns.push({ id: uid(), title: 'برای انجام' })
  const colMap = new Map(lists.map((l, i) => [l.id, columns[i].id]))
  const project = await create('projects', { name: board.name, description: board.desc ?? '', color: PROJECT_COLORS[0], columns, archived: false, order: Date.now() })

  const existing = (await db.labels.toArray()).filter((l) => !l.deleted)
  const labelMap = new Map<string, string>()
  for (const l of board.labels ?? []) {
    const name = l.name || l.color || 'برچسب'
    const found = existing.find((x) => x.name === name)
    labelMap.set(l.id, found?.id ?? (await create('labels', { name, color: TRELLO_COLORS[l.color ?? ''] ?? PROJECT_COLORS[0] })).id)
  }
  const checklists = new Map((board.checklists ?? []).map((c) => [c.id, c]))

  let count = 0
  for (const c of board.cards.filter((x) => !x.closed && colMap.has(x.idList))) {
    await create('tasks', {
      projectId: project.id,
      columnId: colMap.get(c.idList)!,
      title: c.name,
      description: c.desc,
      order: Date.now() + count,
      done: c.dueComplete || colMap.get(c.idList) === columns.at(-1)!.id,
      completedAt: c.dueComplete ? Date.now() : undefined,
      dueDate: c.due ? toISO(new Date(c.due)) : undefined,
      startDate: c.start ? toISO(new Date(c.start)) : undefined,
      weight: 1,
      labels: c.idLabels.map((id) => labelMap.get(id)).filter((x): x is string => !!x),
      checklist: c.idChecklists.flatMap((id) =>
        (checklists.get(id)?.checkItems ?? []).sort((a, b) => a.pos - b.pos).map((i) => ({ id: uid(), text: i.name, done: i.state === 'complete' })),
      ),
    })
    count++
  }
  return { project, count }
}

export async function exportBackup() {
  const data: Record<string, unknown[]> = {}
  for (const t of SYNCED_TABLES) data[t] = await db[t].toArray()
  return JSON.stringify({ app: 'karnama', version: 1, exportedAt: new Date().toISOString(), data })
}

/** Restores a backup by merging: a record replaces the local one only if it is newer. */
export async function importBackup(text: string) {
  const parsed = JSON.parse(text) as { app?: string; data?: Record<string, { id: string; updatedAt: number }[]> }
  if (parsed.app !== 'karnama' || !parsed.data) throw new Error('این فایل پشتیبان کارنما نیست')
  let count = 0
  await db.transaction('rw', SYNCED_TABLES.map((t) => db[t]), async () => {
    for (const t of SYNCED_TABLES) {
      for (const row of parsed.data![t] ?? []) {
        const local = await db[t].get(row.id)
        if (!local || local.updatedAt < row.updatedAt) {
          await (db[t] as unknown as { put: (r: unknown) => Promise<unknown> }).put(row)
          count++
        }
      }
    }
  })
  return count
}

export function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
