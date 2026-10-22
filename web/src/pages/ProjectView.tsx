import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useProject, useTasks, useTemplates } from '../lib/hooks'
import { addTask, applyTemplate, completeTask, moveTask, progress, PROJECT_COLORS, reopenTask } from '../lib/tasks'
import { uid, update, type Project, type Task } from '../lib/db'
import { faNum, todayISO } from '../lib/date'
import TaskCard from '../components/TaskCard'
import TaskDialog from '../components/TaskDialog'
import Gantt from '../components/Gantt'
import DateInput from '../components/DateInput'
import Modal from '../components/Modal'
import QuickAdd from '../components/QuickAdd'

type View = 'board' | 'list' | 'gantt'

export default function ProjectView() {
  const { id } = useParams()
  const project = useProject(id)
  const tasks = useTasks(id)
  const [view, setView] = useState<View>('board')
  const [openTask, setOpenTask] = useState<string>()
  const [showTpl, setShowTpl] = useState(false)

  if (project === undefined) return null
  if (!project || project.deleted) return <div className="empty">پروژه پیدا نشد. <Link to="/projects">بازگشت</Link></div>
  const pct = progress(tasks)

  return (
    <div className="page">
      <div className="page-head">
        <input
          type="color"
          value={project.color}
          list="project-colors"
          onChange={(e) => update('projects', project.id, { color: e.target.value })}
          style={{ width: 32, height: 32, border: 'none', background: 'none', padding: 0 }}
        />
        <datalist id="project-colors">{PROJECT_COLORS.map((c) => <option key={c} value={c} />)}</datalist>
        <input className="title-input grow" value={project.name} onChange={(e) => update('projects', project.id, { name: e.target.value })} />
        <span className="small muted">{faNum(pct)}٪ پیشرفت</span>
        <button className="btn" onClick={() => setShowTpl(true)}>افزودن از قالب</button>
      </div>
      <input className="input" placeholder="توضیح پروژه…" value={project.description} onChange={(e) => update('projects', project.id, { description: e.target.value })} />
      <div className="tabs">
        {(['board', 'list', 'gantt'] as View[]).map((v) => (
          <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
            {{ board: 'برد', list: 'فهرست', gantt: 'گانت' }[v]}
          </button>
        ))}
      </div>
      {view === 'board' && <Board project={project} tasks={tasks} onOpen={setOpenTask} />}
      {view === 'list' && <TaskList project={project} tasks={tasks} onOpen={setOpenTask} />}
      {view === 'gantt' && <Gantt tasks={tasks} onOpen={setOpenTask} color={project.color} />}
      {openTask && <TaskDialog taskId={openTask} onClose={() => setOpenTask(undefined)} />}
      {showTpl && <TemplateDialog project={project} onClose={() => setShowTpl(false)} />}
    </div>
  )
}

function Board({ project, tasks, onOpen }: { project: Project; tasks: Task[]; onOpen: (id: string) => void }) {
  const [over, setOver] = useState<string>()
  const setColumns = (columns: Project['columns']) => update('projects', project.id, { columns })

  return (
    <div className="board">
      {project.columns.map((col, i) => {
        // Tasks whose column was removed (e.g. on another device) fall back to the first column.
        const colTasks = tasks
          .filter((t) => t.columnId === col.id || (i === 0 && !project.columns.some((c) => c.id === t.columnId)))
          .sort((a, b) => a.order - b.order)
        return (
          <div
            key={col.id}
            className={`column ${over === col.id ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(col.id) }}
            onDragLeave={() => setOver(undefined)}
            onDrop={(e) => {
              setOver(undefined)
              const t = tasks.find((x) => x.id === e.dataTransfer.getData('text/task'))
              if (t && t.columnId !== col.id) moveTask(t, project, col.id)
            }}
          >
            <div className="column-head">
              <input className="title-input grow" value={col.title} onChange={(e) => setColumns(project.columns.map((c) => (c.id === col.id ? { ...c, title: e.target.value } : c)))} />
              <span className="chip">{faNum(colTasks.length)}</span>
              <ColumnMenu
                canDelete={project.columns.length > 1 && colTasks.length === 0}
                canLeft={i < project.columns.length - 1}
                canRight={i > 0}
                onMove={(d) => {
                  const cols = [...project.columns]
                  ;[cols[i], cols[i + d]] = [cols[i + d], cols[i]]
                  setColumns(cols)
                }}
                onDelete={() => setColumns(project.columns.filter((c) => c.id !== col.id))}
              />
            </div>
            {i === project.columns.length - 1 && <div className="small muted">کارهای این ستون انجام‌شده حساب می‌شوند.</div>}
            <div className="col">
              {colTasks.map((t) => <TaskCard key={t.id} task={t} draggable onOpen={() => onOpen(t.id)} />)}
            </div>
            <QuickAdd onAdd={(title) => addTask(project, title, col.id)} />
          </div>
        )
      })}
      <button className="btn add-column" onClick={() => setColumns([...project.columns, { id: uid(), title: 'ستون جدید' }])}>+ ستون جدید</button>
    </div>
  )
}

function ColumnMenu({ canDelete, canLeft, canRight, onMove, onDelete }: { canDelete: boolean; canLeft: boolean; canRight: boolean; onMove: (d: 1 | -1) => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn ghost sm" onClick={() => setOpen(!open)}>⋯</button>
      {open && (
        <div className="card menu" onMouseLeave={() => setOpen(false)}>
          <button className="btn ghost" disabled={!canRight} onClick={() => { onMove(-1); setOpen(false) }}>انتقال به راست</button>
          <button className="btn ghost" disabled={!canLeft} onClick={() => { onMove(1); setOpen(false) }}>انتقال به چپ</button>
          <button className="btn ghost danger" disabled={!canDelete} title="فقط ستون خالی حذف می‌شود" onClick={onDelete}>حذف ستون</button>
        </div>
      )}
    </div>
  )
}

function TaskList({ project, tasks, onOpen }: { project: Project; tasks: Task[]; onOpen: (id: string) => void }) {
  const [showDone, setShowDone] = useState(false)
  const list = tasks.filter((t) => showDone || !t.done).sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'))
  return (
    <div className="col" style={{ maxWidth: 760 }}>
      <QuickAdd onAdd={(title) => addTask(project, title)} />
      <label className="row small"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />نمایش کارهای انجام‌شده</label>
      {list.map((t) => (
        <TaskCard key={t.id} task={t} onOpen={() => onOpen(t.id)} onToggle={() => (t.done ? reopenTask(t, project) : completeTask(t, project))} />
      ))}
      {list.length === 0 && <div className="empty">وظیفه‌ای نیست.</div>}
    </div>
  )
}

function TemplateDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const templates = useTemplates()
  const [tplId, setTplId] = useState('')
  const [start, setStart] = useState<string | undefined>(todayISO())
  const tpl = templates.find((t) => t.id === tplId)
  return (
    <Modal
      title="افزودن وظایف از قالب"
      onClose={onClose}
      footer={<button className="btn primary" disabled={!tpl || !start} onClick={async () => { await applyTemplate(tpl!, project, start!); onClose() }}>افزودن {tpl && `${faNum(tpl.steps.length)} وظیفه`}</button>}
    >
      {templates.length === 0 ? (
        <div className="muted">هنوز قالبی نساخته‌اید. از صفحه‌ی <Link to="/templates">قالب‌ها</Link> بسازید.</div>
      ) : (
        <>
          <label className="field"><span>قالب</span>
            <select className="input" value={tplId} onChange={(e) => setTplId(e.target.value)}>
              <option value="">انتخاب کنید</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <div className="field"><span>تاریخ شروع</span><DateInput value={start} onChange={setStart} /></div>
        </>
      )}
    </Modal>
  )
}
