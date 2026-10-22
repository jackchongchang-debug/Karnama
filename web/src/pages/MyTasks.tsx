import { useEffect, useState } from 'react'
import { useProjects, useTasks } from '../lib/hooks'
import { addTask, completeTask, groupTasks, reopenTask } from '../lib/tasks'
import { todayISO } from '../lib/date'
import { ensureInbox, INBOX_ID } from '../lib/seed'
import type { Task } from '../lib/db'
import TaskCard from '../components/TaskCard'
import TaskDialog from '../components/TaskDialog'
import QuickAdd from '../components/QuickAdd'

export default function MyTasks() {
  const tasks = useTasks()
  const projects = useProjects()
  const [openTask, setOpenTask] = useState<string>()
  const [q, setQ] = useState('')
  useEffect(() => { ensureInbox() }, [])

  const live = tasks.filter((t) => projects.some((p) => p.id === t.projectId && !p.archived))
  const filtered = q ? live.filter((t) => t.title.includes(q) || t.description.includes(q)) : live
  const name = (t: Task) => projects.find((p) => p.id === t.projectId)?.name
  const toggle = (t: Task) => {
    const p = projects.find((x) => x.id === t.projectId)
    if (p) return t.done ? reopenTask(t, p) : completeTask(t, p)
  }

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="page-head">
        <h1 className="grow">کارهای من</h1>
        <input className="input" style={{ maxWidth: 240 }} placeholder="جستجو…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <QuickAdd
        placeholder="+ کار جدید برای امروز (در «کارهای شخصی»)"
        onAdd={async (title) => addTask(await ensureInbox(), title, undefined, { dueDate: todayISO() })}
      />
      {groupTasks(filtered).map((g) =>
        g.items.length ? (
          <section key={g.key} className="col">
            <h3 style={g.key === 'overdue' ? { color: 'var(--danger)' } : undefined}>{g.title}</h3>
            {g.items.map((t) => (
              <TaskCard key={t.id} task={t} projectName={t.projectId === INBOX_ID ? undefined : name(t)} onOpen={() => setOpenTask(t.id)} onToggle={() => toggle(t)} />
            ))}
          </section>
        ) : null,
      )}
      {filtered.every((t) => t.done) && <div className="empty">کار بازی ندارید 🎉</div>}
      {openTask && <TaskDialog taskId={openTask} onClose={() => setOpenTask(undefined)} />}
    </div>
  )
}
