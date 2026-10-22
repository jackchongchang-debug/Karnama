import { Link } from 'react-router-dom'
import { useSyncState } from '../lib/sync'

export default function SyncBadge() {
  const s = useSyncState()
  const text =
    !s.configured ? 'همگام‌سازی خاموش'
    : s.status === 'syncing' ? 'در حال همگام‌سازی…'
    : s.status === 'error' ? 'خطا در همگام‌سازی'
    : s.status === 'offline' ? 'آفلاین'
    : 'همگام است'
  const color = s.status === 'error' ? 'var(--danger)' : s.configured && s.status === 'idle' ? 'var(--success)' : 'var(--muted)'
  return (
    <Link to="/settings" className="row small" style={{ color, padding: '0 8px' }}>
      <span className="dot" style={{ background: color }} />
      {text}
    </Link>
  )
}
