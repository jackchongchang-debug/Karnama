import { useSyncExternalStore } from 'react'
import { db, getMeta, onLocalChange, setMeta, SYNCED_TABLES, type Base, type SyncedTable } from './db'

/**
 * Sync through the user's own Google Drive, with no server of our own. All data lives in one JSON
 * file in the app's hidden Drive folder (appDataFolder), which only this app can see. Each sync
 * downloads that file, merges it into the local database record by record (newest `updatedAt`
 * wins; deletes are soft so they merge too), and uploads the merged result if it changed.
 */

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const FILE_NAME = 'karnama.json'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export const DEFAULT_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

interface SyncMeta {
  enabled: boolean
  clientId: string
  email?: string
  token?: string
  tokenExpires?: number
  fileId?: string
  revision?: string
  lastSync?: number
}

type Status = 'off' | 'idle' | 'syncing' | 'error' | 'offline' | 'signin'

let state = { configured: false, status: 'off' as Status, lastSync: 0, error: '', email: '' }
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

const getSyncMeta = () => getMeta<SyncMeta | null>('gdrive', null)
const saveSyncMeta = async (patch: Partial<SyncMeta>) => {
  const cur = (await getSyncMeta()) ?? { enabled: false, clientId: DEFAULT_CLIENT_ID }
  const next = { ...cur, ...patch }
  await setMeta('gdrive', next)
  return next
}
export const getConfig = getSyncMeta

// ---- Google sign-in (Google Identity Services token flow) ----

interface TokenResponse { access_token?: string; expires_in?: number; error?: string; error_description?: string }
interface TokenClient { requestAccessToken: (o?: { prompt?: string; login_hint?: string }) => void }
declare global {
  interface Window {
    google?: { accounts: { oauth2: { initTokenClient: (c: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string; message?: string }) => void }) => TokenClient; revoke: (t: string, cb?: () => void) => void } } }
  }
}

let gisLoaded: Promise<void> | null = null
function loadGis() {
  gisLoaded ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { gisLoaded = null; reject(new Error('بارگذاری ورود گوگل ناموفق بود؛ اتصال اینترنت را بررسی کنید')) }
    document.head.appendChild(s)
  })
  return gisLoaded
}

/** Opens Google's consent popup. Must be called from a click, or browsers block the popup. */
async function requestToken(clientId: string, prompt: '' | 'consent', hint?: string): Promise<{ token: string; expires: number }> {
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => {
        if (r.access_token) resolve({ token: r.access_token, expires: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000 })
        else reject(new Error(r.error_description || r.error || 'ورود به گوگل انجام نشد'))
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'پنجره‌ی ورود بسته شد' : e.message || 'ورود به گوگل انجام نشد')),
    })
    client.requestAccessToken({ prompt, login_hint: hint })
  })
}

export async function connect(clientId: string) {
  clientId = clientId.trim()
  if (!clientId) throw new Error('شناسه‌ی کلاینت گوگل وارد نشده است')
  const { token, expires } = await requestToken(clientId, 'consent')
  const about = await fetch(`${API}/about?fields=user(emailAddress)`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())
  const email = about?.user?.emailAddress as string | undefined
  // A new account starts from scratch: forget any file from a previous account.
  await saveSyncMeta({ enabled: true, clientId, token, tokenExpires: expires, email, fileId: undefined, revision: undefined })
  emit({ configured: true, email: email ?? '', error: '' })
  await syncNow()
}

/** Renews an expired sign-in; call from a click. */
export async function reconnect() {
  const m = await getSyncMeta()
  if (!m) return
  const { token, expires } = await requestToken(m.clientId, '', m.email)
  await saveSyncMeta({ token, tokenExpires: expires })
  await syncNow()
}

export async function disconnect() {
  const m = await getSyncMeta()
  if (m?.token) window.google?.accounts.oauth2.revoke(m.token)
  await setMeta('gdrive', null)
  emit({ configured: false, status: 'off', error: '', email: '' })
}

// ---- Drive file access ----

class AuthError extends Error {}

async function drive(token: string, url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })
  if (res.status === 401) throw new AuthError('ورود به گوگل منقضی شده است')
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message || `خطای گوگل‌درایو (${res.status})`)
  }
  return res
}

async function findFile(token: string): Promise<{ id: string; headRevisionId: string } | undefined> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`)
  const res = await drive(token, `${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,headRevisionId)&orderBy=modifiedTime desc`)
  return (await res.json()).files?.[0]
}

async function fileRevision(token: string, id: string): Promise<string> {
  const res = await drive(token, `${API}/files/${id}?fields=headRevisionId`)
  return (await res.json()).headRevisionId
}

type Snapshot = Record<string, Base[]>

async function download(token: string, id: string): Promise<Snapshot> {
  const res = await drive(token, `${API}/files/${id}?alt=media`)
  const data = await res.json()
  return data?.app === 'karnama' ? data.data ?? {} : {}
}

async function upload(token: string, id: string | undefined, snapshot: Snapshot): Promise<{ id: string; headRevisionId: string }> {
  const body = JSON.stringify({ app: 'karnama', version: 1, savedAt: new Date().toISOString(), data: snapshot })
  if (id) {
    const res = await drive(token, `${UPLOAD}/files/${id}?uploadType=media&fields=id,headRevisionId`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    return res.json()
  }
  const boundary = 'karnama' + Math.random().toString(36).slice(2)
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`
  const res = await drive(token, `${UPLOAD}/files?uploadType=multipart&fields=id,headRevisionId`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  })
  return res.json()
}

// ---- Merge ----

/** Merges remote rows into the local database; returns true if anything local changed. */
async function mergeIntoLocal(remote: Snapshot) {
  let changed = false
  await db.transaction('rw', SYNCED_TABLES.map((t) => db[t]), async () => {
    for (const t of SYNCED_TABLES) {
      const table = db[t as SyncedTable] as unknown as { get: (id: string) => Promise<Base | undefined>; put: (r: Base) => Promise<unknown> }
      for (const row of remote[t] ?? []) {
        if (!row || typeof row.id !== 'string') continue
        const local = await table.get(row.id)
        if (!local || local.updatedAt < row.updatedAt) {
          await table.put(row)
          changed = true
        }
      }
    }
  })
  return changed
}

async function localSnapshot(): Promise<Snapshot> {
  const out: Snapshot = {}
  for (const t of SYNCED_TABLES) out[t] = (await db[t].toArray()).sort((a, b) => a.id.localeCompare(b.id))
  return out
}

/** True when the remote file lacks a row, or has an older copy of one, that this device holds. */
function remoteIsBehind(remote: Snapshot, local: Snapshot) {
  for (const t of SYNCED_TABLES) {
    const r = new Map((remote[t] ?? []).map((row) => [row.id, row.updatedAt]))
    for (const row of local[t] ?? []) if ((r.get(row.id) ?? -1) < row.updatedAt) return true
  }
  return false
}

async function hasLocalChanges(since: number) {
  for (const t of SYNCED_TABLES) if ((await db[t].where('updatedAt').above(since - 5000).count()) > 0) return true
  return false
}

// ---- Sync loop ----

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
  let m = await getSyncMeta()
  if (!m?.enabled) return emit({ configured: false, status: 'off' })
  emit({ configured: true, email: m.email ?? '' })
  if (!navigator.onLine) return emit({ status: 'offline' })
  if (!m.token || (m.tokenExpires ?? 0) < Date.now()) return emit({ status: 'signin', error: '' })
  const token = m.token
  emit({ status: 'syncing' })
  try {
    // Retry if another device uploaded between our download and our upload.
    for (let attempt = 0; attempt < 3; attempt++) {
      let fileId = m.fileId
      let revision = fileId ? await fileRevision(token, fileId).catch(() => undefined) : undefined
      if (!revision) {
        const f = await findFile(token)
        fileId = f?.id
        revision = f?.headRevisionId
      }
      // Nothing changed on either side since the last sync: skip the download.
      if (fileId && revision === m.revision && !(await hasLocalChanges(m.lastSync ?? 0))) {
        m = await saveSyncMeta({ lastSync: Date.now() })
        break
      }
      const remote = fileId ? await download(token, fileId) : {}
      await mergeIntoLocal(remote)
      const local = await localSnapshot()
      if (fileId && !remoteIsBehind(remote, local)) {
        m = await saveSyncMeta({ fileId, revision, lastSync: Date.now() })
        break
      }
      if (fileId && (await fileRevision(token, fileId)) !== revision) continue
      const saved = await upload(token, fileId, local)
      m = await saveSyncMeta({ fileId: saved.id, revision: saved.headRevisionId, lastSync: Date.now() })
      break
    }
    emit({ status: 'idle', lastSync: m.lastSync ?? Date.now(), error: '' })
  } catch (e) {
    if (e instanceof AuthError) {
      await saveSyncMeta({ token: undefined, tokenExpires: undefined })
      return emit({ status: 'signin', error: '' })
    }
    emit({ status: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}

let timer: ReturnType<typeof setTimeout> | undefined

/** Starts background sync: on launch, shortly after local edits, on reconnect, on focus, and every two minutes. */
export function startSync() {
  getSyncMeta().then((m) => emit({ configured: !!m?.enabled, email: m?.email ?? '', lastSync: m?.lastSync ?? 0 }))
  syncNow()
  onLocalChange(() => {
    clearTimeout(timer)
    timer = setTimeout(syncNow, 3000)
  })
  window.addEventListener('online', () => syncNow())
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncNow())
  setInterval(syncNow, 120000)
}
