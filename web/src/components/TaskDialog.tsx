import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import Modal from './Modal'
import DateInput from './DateInput'
import LabelPicker from './LabelPicker'
import { db, remove, uid, update, type Frequency, type Task } from '../lib/db'
import { completeTask, duplicateTask, reopenTask } from '../lib/tasks'
import { useProjects } from '../lib/hooks'
import { FREQ_LABEL, faNum, fmtDateTime, toISO } from '../lib/date'

export default function TaskDialog({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const task = useLiveQuery(() => db.tasks.get(taskId), [taskId])
  const projects = useProjects()
  const [newItem, setNewItem] = useState('')

  if (!task) return null
  const project = projects.find((p) => p.id === task.projectId)
  const set = (changes: Partial<Task>) => update('tasks', task.id, changes)
  const checklistDone = task.checklist.filter((c) => c.done).length

  const reminderDate = task.reminderAt ? toISO(new Date(task.reminderAt)) : undefined
  const reminderTime = task.reminderAt
    ? new Date(task.reminderAt).toTimeString().slice(0, 5)
    : '09:00'
  const setReminder = (date: string | undefined, time: string) => {
    if (!date) return set({ reminderAt: undefined })
    const [h, m] = time.split(':').map(Number)
    const d = new Date(`${date}T00:00:00`)
    d.setHours(h, m)
    set({ reminderAt: d.toISOString() })
  }

  return (
    <Modal
      wide
      onClose={onClose}
      title={
        <label className="row">
          <input
            type="checkbox"
            checked={task.done}
            onChange={() => project && (task.done ? reopenTask(task, project) : completeTask(task, project))}
          />
          <span className={task.done ? 'muted' : ''}>{task.done ? 'انجام شده' : 'وظیفه'}</span>
        </label>
      }
      footer={
        <>
          <button className="btn" onClick={() => duplicateTask(task)}>کپی وظیفه</button>
          <div className="spacer" />
          <button className="btn danger" onClick={() => { remove('tasks', task.id); onClose() }}>حذف</button>
        </>
      }
    >
      <input className="input" style={{ fontSize: '1.1rem', fontWeight: 500 }} value={task.title} onChange={(e) => set({ title: e.target.value })} />

      <div className="grid2">
        <label className="field">
          <span>پروژه</span>
          <select
            className="input"
            value={task.projectId}
            onChange={(e) => {
              const p = projects.find((x) => x.id === e.target.value)
              if (p) set({ projectId: p.id, columnId: p.columns[0].id, done: false })
            }}
          >
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>مرحله</span>
          <select className="input" value={task.columnId} onChange={(e) => set({ columnId: e.target.value })}>
            {project?.columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <div className="field"><span>تاریخ شروع</span><DateInput value={task.startDate} onChange={(v) => set({ startDate: v })} /></div>
        <div className="field"><span>تاریخ پایان</span><DateInput value={task.endDate} onChange={(v) => set({ endDate: v })} /></div>
        <div className="field"><span>ددلاین</span><DateInput value={task.dueDate} onChange={(v) => set({ dueDate: v })} /></div>
        <div className="field">
          <span>یادآور {task.reminderAt && <span className="small">({fmtDateTime(task.reminderAt)})</span>}</span>
          <div className="row">
            <div className="grow"><DateInput value={reminderDate} onChange={(v) => setReminder(v, reminderTime)} /></div>
            <input type="time" className="input" style={{ width: 110 }} value={reminderTime} disabled={!reminderDate} onChange={(e) => setReminder(reminderDate, e.target.value)} />
          </div>
        </div>
        <label className="field">
          <span>وزن وظیفه: {faNum(task.weight)}</span>
          <input type="range" min={1} max={10} value={task.weight} onChange={(e) => set({ weight: Number(e.target.value) })} />
        </label>
        <div className="field">
          <span>تکرار</span>
          <div className="row">
            <select
              className="input"
              value={task.recurrence?.freq ?? ''}
              onChange={(e) => set({ recurrence: e.target.value ? { freq: e.target.value as Frequency, interval: task.recurrence?.interval ?? 1 } : undefined })}
            >
              <option value="">بدون تکرار</option>
              {Object.entries(FREQ_LABEL).map(([k, v]) => <option key={k} value={k}>هر {v}</option>)}
            </select>
            {task.recurrence && (
              <>
                <span className="small muted">هر</span>
                <input type="number" min={1} className="input" style={{ width: 70 }} value={task.recurrence.interval} onChange={(e) => set({ recurrence: { ...task.recurrence!, interval: Math.max(1, Number(e.target.value)) } })} />
                <span className="small muted">{FREQ_LABEL[task.recurrence.freq]}</span>
              </>
            )}
          </div>
          {task.recurrence && !(task.dueDate || task.startDate) && <span className="small" style={{ color: 'var(--warning)' }}>برای تکرار، ددلاین یا تاریخ شروع لازم است.</span>}
        </div>
      </div>

      <div className="field">
        <span>برچسب‌ها</span>
        <LabelPicker value={task.labels} onChange={(labels) => set({ labels })} />
      </div>

      <label className="field">
        <span>توضیحات</span>
        <textarea className="input" value={task.description} onChange={(e) => set({ description: e.target.value })} />
      </label>

      <div className="field">
        <span>چک‌لیست {task.checklist.length > 0 && `(${faNum(checklistDone)} از ${faNum(task.checklist.length)})`}</span>
        {task.checklist.map((c) => (
          <div key={c.id} className="row">
            <input type="checkbox" checked={c.done} onChange={() => set({ checklist: task.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })} />
            <input className="input grow" value={c.text} style={c.done ? { textDecoration: 'line-through', opacity: 0.6 } : undefined} onChange={(e) => set({ checklist: task.checklist.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)) })} />
            <button className="btn ghost sm" onClick={() => set({ checklist: task.checklist.filter((x) => x.id !== c.id) })}>✕</button>
          </div>
        ))}
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newItem.trim()) return
            set({ checklist: [...task.checklist, { id: uid(), text: newItem.trim(), done: false }] })
            setNewItem('')
          }}
        >
          <input className="input grow" placeholder="مورد جدید…" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
          <button className="btn">افزودن</button>
        </form>
      </div>
    </Modal>
  )
}
