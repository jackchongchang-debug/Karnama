import { useState } from 'react'
import { useNotes } from '../lib/hooks'
import { create, remove, update } from '../lib/db'
import { fmt, toISO } from '../lib/date'
import Modal from '../components/Modal'

const NOTE_COLORS = ['', '#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#ede9fe']

export default function Notes() {
  const notes = useNotes()
  const [open, setOpen] = useState<string>()
  const [q, setQ] = useState('')
  const list = notes
    .filter((n) => !q || n.title.includes(q) || n.body.includes(q))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned))
  const note = notes.find((n) => n.id === open)

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="grow">یادداشت‌ها</h1>
        <input className="input" style={{ maxWidth: 240 }} placeholder="جستجو…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary" onClick={async () => setOpen((await create('notes', { title: '', body: '', color: '', pinned: false })).id)}>یادداشت جدید</button>
      </div>
      {list.length === 0 && <div className="empty">یادداشتی نیست.</div>}
      <div className="project-grid">
        {list.map((n) => (
          <div key={n.id} className="card note-card" style={n.color ? { background: n.color, color: '#1f2333' } : undefined} onClick={() => setOpen(n.id)}>
            <div className="row"><strong className="grow">{n.title || 'بدون عنوان'}</strong>{n.pinned && <span>📌</span>}</div>
            <div className="note-body">{n.body}</div>
            <div className="small" style={{ opacity: 0.6 }}>{fmt(toISO(new Date(n.updatedAt)))}</div>
          </div>
        ))}
      </div>
      {note && (
        <Modal
          wide
          title={<input className="title-input" style={{ width: '100%' }} placeholder="عنوان" value={note.title} onChange={(e) => update('notes', note.id, { title: e.target.value })} />}
          onClose={() => setOpen(undefined)}
          footer={
            <>
              <button className="btn" onClick={() => update('notes', note.id, { pinned: !note.pinned })}>{note.pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}</button>
              {NOTE_COLORS.map((c) => (
                <button key={c} className="dot" style={{ width: 22, height: 22, cursor: 'pointer', background: c || 'var(--surface)', border: note.color === c ? '2px solid var(--primary)' : '1px solid var(--border)' }} onClick={() => update('notes', note.id, { color: c })} />
              ))}
              <div className="spacer" />
              <button className="btn danger" onClick={() => { remove('notes', note.id); setOpen(undefined) }}>حذف</button>
            </>
          }
        >
          <textarea autoFocus className="input" style={{ minHeight: 320 }} value={note.body} onChange={(e) => update('notes', note.id, { body: e.target.value })} />
        </Modal>
      )}
    </div>
  )
}
