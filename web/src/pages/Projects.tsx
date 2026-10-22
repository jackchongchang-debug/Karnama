import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProjects, useTasks } from '../lib/hooks'
import { createProject, duplicateProject, progress, PROJECT_COLORS, templateFromProject } from '../lib/tasks'
import { remove, update } from '../lib/db'
import { faNum } from '../lib/date'

export default function Projects() {
  const projects = useProjects()
  const tasks = useTasks()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const list = projects.filter((p) => p.archived === showArchived)

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="grow">پروژه‌ها</h1>
        <label className="row small"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />بایگانی‌شده‌ها</label>
      </div>
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          const p = await createProject(name.trim(), PROJECT_COLORS[projects.length % PROJECT_COLORS.length])
          setName('')
          nav(`/projects/${p.id}`)
        }}
      >
        <input className="input" style={{ maxWidth: 360 }} placeholder="نام پروژه‌ی جدید" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn primary">ساخت پروژه</button>
      </form>
      {list.length === 0 && <div className="empty">{showArchived ? 'پروژه‌ی بایگانی‌شده‌ای نیست.' : 'هنوز پروژه‌ای نساخته‌اید.'}</div>}
      <div className="project-grid">
        {list.map((p) => {
          const pt = tasks.filter((t) => t.projectId === p.id)
          const open = pt.filter((t) => !t.done).length
          const pct = progress(pt)
          return (
            <div key={p.id} className="card project-card" style={{ borderTop: `4px solid ${p.color}` }}>
              <Link to={`/projects/${p.id}`} className="col" style={{ color: 'inherit', gap: 6 }}>
                <h3>{p.name}</h3>
                {p.description && <div className="muted small">{p.description}</div>}
                <div className="small muted">{faNum(open)} وظیفه‌ی باز از {faNum(pt.length)}</div>
                <div className="progress"><div style={{ width: `${pct}%`, background: p.color }} /></div>
                <div className="small">{faNum(pct)}٪ پیشرفت</div>
              </Link>
              <div className="row wrap">
                <button className="btn sm" onClick={() => duplicateProject(p)}>کپی</button>
                <button className="btn sm" onClick={async () => { await templateFromProject(p, p.name); nav('/templates') }}>ذخیره به‌عنوان قالب</button>
                <button className="btn sm" onClick={() => update('projects', p.id, { archived: !p.archived })}>{p.archived ? 'بازگردانی' : 'بایگانی'}</button>
                <button className="btn sm danger" onClick={() => confirmDelete(p.name) && remove('projects', p.id)}>حذف</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function confirmDelete(name: string) {
  return window.confirm(`پروژه‌ی «${name}» حذف شود؟`)
}
