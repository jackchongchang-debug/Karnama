import type { Task } from '../lib/db'
import { faNum, fmt, todayISO } from '../lib/date'
import { LabelChips } from './LabelPicker'

export default function TaskCard({
  task,
  onOpen,
  onToggle,
  projectName,
  draggable,
}: {
  task: Task
  onOpen: () => void
  onToggle?: () => void
  projectName?: string
  draggable?: boolean
}) {
  const overdue = !task.done && task.dueDate && task.dueDate < todayISO()
  const done = task.checklist.filter((c) => c.done).length
  return (
    <div
      className="task-card card"
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData('text/task', task.id)}
      onClick={onOpen}
    >
      <div className="row" style={{ alignItems: 'flex-start' }}>
        {onToggle && (
          <input type="checkbox" checked={task.done} onClick={(e) => e.stopPropagation()} onChange={onToggle} style={{ marginTop: 5 }} />
        )}
        <div className="grow" style={task.done ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>{task.title}</div>
      </div>
      <div className="row wrap small">
        {projectName && <span className="chip">{projectName}</span>}
        <LabelChips ids={task.labels} />
        {task.dueDate && (
          <span className="chip" style={overdue ? { background: 'var(--danger)', color: '#fff' } : undefined}>⏱ {fmt(task.dueDate, 'd MMMM')}</span>
        )}
        {task.checklist.length > 0 && <span className="chip">☑ {faNum(done)}/{faNum(task.checklist.length)}</span>}
        {task.recurrence && <span className="chip" title="تکرارشونده">↻</span>}
        {task.reminderAt && <span className="chip" title="یادآور">🔔</span>}
        {task.weight > 1 && <span className="chip" title="وزن">⚖ {faNum(task.weight)}</span>}
      </div>
    </div>
  )
}
