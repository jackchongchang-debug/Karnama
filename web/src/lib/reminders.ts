import { useEffect } from 'react'
import { db } from './db'

const KEY = 'karnama.reminded'

function reminded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function save(set: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set].slice(-500)))
  } catch {
    /* storage unavailable */
  }
}

export function toast(text: string) {
  window.dispatchEvent(new CustomEvent('karnama:toast', { detail: text }))
}

async function check() {
  const now = new Date().toISOString()
  const due = await db.tasks.filter((t) => !t.deleted && !t.done && !!t.reminderAt && t.reminderAt <= now).toArray()
  const seen = reminded()
  for (const t of due) {
    const key = `${t.id}@${t.reminderAt}`
    if (seen.has(key)) continue
    seen.add(key)
    // Skip reminders that went off more than a day ago (e.g. app was closed).
    if (Date.now() - new Date(t.reminderAt!).getTime() > 86400000) continue
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('یادآور کارنما', { body: t.title, icon: `${import.meta.env.BASE_URL}favicon.svg`, lang: 'fa', dir: 'rtl' })
    }
    toast(`🔔 ${t.title}`)
  }
  save(seen)
}

/** Fires reminders while the app is open. */
export function useReminders() {
  useEffect(() => {
    check()
    const id = setInterval(check, 30000)
    return () => clearInterval(id)
  }, [])
}
