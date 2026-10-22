import { db } from './db'

export const INBOX_ID = 'inbox'

/**
 * A default project with fixed ids, so every device creates the same one. Its updatedAt of 0
 * means any real edit from another device wins during sync.
 */
export async function ensureInbox() {
  const existing = await db.projects.get(INBOX_ID)
  if (existing) return existing
  const inbox = {
    id: INBOX_ID,
    updatedAt: 0,
    deleted: 0 as const,
    name: 'کارهای شخصی',
    description: '',
    color: '#4f46e5',
    columns: [
      { id: 'inbox-todo', title: 'برای انجام' },
      { id: 'inbox-doing', title: 'در حال انجام' },
      { id: 'inbox-done', title: 'انجام شده' },
    ],
    archived: false,
    order: -1,
  }
  await db.projects.put(inbox)
  return inbox
}
