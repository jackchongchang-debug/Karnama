import { useSyncExternalStore } from 'react'
import { db, getMeta, onLocalChange, setMeta, SYNCED_TABLES, type Base, type SyncedTable } from './db'

/**
 * Sync protocol (see server/): the client pushes every record changed since its last push and
 * pulls every record the server stored after its cursor. Conflicts resolve per record by the
 * newest `updatedAt` (last write wins). Deletes are soft, so they sync like any other change.
 */
export interface SyncConfig {
  url: string
  token: string
  cursor: number
  lastPush: number
}

type Status = 'idle' | 'syncing' | 'error' | 'offline'

let state = { configured: false, status: 'idle' as Status, lastSync: 0, error: '' }
const subs = new Set<() => void>()
const emit = (s: Partial<typeof state>) => {
  state = { ...state, ...s }
  subs.forEach((f) => f())
}

export function useSyncState() {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f) },
    () => state,
  )
}

export const getConfig = () => getMeta<SyncConfig | null>('sync', null)

function apiUrl(base: string, path: string) {
  return base.replace(/\/+$/, '') + path
}

async function request<T>(base: string, path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(apiUrl(base, path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `خطای سرور (${res.status})`)
  return data as T
}

export async function login(url: string, password: string, deviceName: string) {
  const { token } = await request<{ token: string }>(url, '/api/login', { password, device: deviceName })
  await setMeta('sync', { url, token, cursor: 0, lastPush: 0 } satisfies SyncConfig)
  emit({ configured: true, error: '' })
  await syncNow()
}

export async function logout() {
  await setMeta('sync', null)
  emit({ configured: false, status: 'idle', error: '' })
}

let running: Promise<void> | null = null
let again = false

export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    try {
      do {
        again = false
        await syncOnce()
      } while (again)
    } finally {
      running = null
    }
  })()
  return running
}

async function syncOnce() {
  const cfg = await getConfig()
  if (!cfg) return emit({ configured: false })
  if (!navigator.onLine) return emit({ configured: true, status: 'offline' })
  emit({ configured: true, status: 'syncing' })
  try {
    const pushStart = Date.now()
    const changes: Record<string, Base[]> = {}
    for (const t of SYNCED_TABLES) {
      const rows = await db[t].where('updatedAt').above(cfg.lastPush - 1).toArray()
      if (rows.length) changes[t] = rows
    }
    const res = await request<{ cursor: number; changes: Record<string, Base[]> }>(
      cfg.url,
      '/api/sync',
      { cursor: cfg.cursor, changes },
      cfg.token,
    )
    await db.transaction('rw', SYNCED_TABLES.map((t) => db[t]), async () => {
      for (const [t, rows] of Object.entries(res.changes)) {
        const table = db[t as SyncedTable] as unknown as { get: (id: string) => Promise<Base | undefined>; put: (r: Base) => Promise<unknown> }
        for (const row of rows) {
          const local = await table.get(row.id)
          if (!local || local.updatedAt <= row.updatedAt) await table.put(row)
        }
      }
    })
    await setMeta('sync', { ...cfg, cursor: res.cursor, lastPush: pushStart })
    emit({ status: 'idle', lastSync: Date.now(), error: '' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/401|توکن|token/i.test(msg)) await logout()
    emit({ status: 'error', error: msg })
  }
}

let timer: ReturnType<typeof setTimeout> | undefined

/** Starts background sync: on launch, shortly after local edits, on reconnect, and every minute. */
export function startSync() {
  getConfig().then((c) => emit({ configured: !!c }))
  syncNow()
  onLocalChange(() => {
    clearTimeout(timer)
    timer = setTimeout(syncNow, 1500)
  })
  window.addEventListener('online', () => syncNow())
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncNow())
  setInterval(syncNow, 60000)
}
