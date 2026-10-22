import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTemplates } from '../lib/hooks'
import { create, remove, update, type Template, type TemplateStep } from '../lib/db'
import { applyTemplate, createProject } from '../lib/tasks'
import { faNum, todayISO } from '../lib/date'
import Modal from '../components/Modal'
import DateInput from '../components/DateInput'

const blankStep = (): TemplateStep => ({ title: '', description: '', offsetDays: 0, durationDays: 1, weight: 1, labels: [], checklist: [] })

export default function Templates() {
  const templates = useTemplates()
  const [edit, setEdit] = useState<string>()
  const [use, setUse] = useState<Template>()
  const tpl = templates.find((t) => t.id === edit)

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="grow">قالب‌ها و فرایندها</h1>
        <button className="btn primary" onClick={async () => setEdit((await create('templates', { name: 'قالب جدید', description: '', steps: [blankStep()] })).id)}>قالب جدید</button>
      </div>
      <div className="muted small">قالب، فهرستی از مراحل یک فرایند تکرارشونده است. با هر بار استفاده، مراحل به‌صورت وظیفه با تاریخ‌های مناسب ساخته می‌شوند. از صفحه‌ی پروژه‌ها هم می‌توانید یک پروژه را به قالب تبدیل کنید.</div>
      {templates.length === 0 && <div className="empty">قالبی نیست.</div>}
      <div className="project-grid">
        {templates.map((t) => (
          <div key={t.id} className="card project-card">
            <h3>{t.name}</h3>
            {t.description && <div className="small muted">{t.description}</div>}
            <ol className="small" style={{ margin: 0, paddingInlineStart: 18 }}>
              {t.steps.slice(0, 5).map((s, i) => <li key={i}>{s.title || '—'}</li>)}
              {t.steps.length > 5 && <li className="muted">و {faNum(t.steps.length - 5)} مرحله‌ی دیگر</li>}
            </ol>
            <div className="row wrap">
              <button className="btn sm primary" onClick={() => setUse(t)}>ساخت پروژه</button>
              <button className="btn sm" onClick={() => setEdit(t.id)}>ویرایش</button>
              <button className="btn sm" onClick={() => create('templates', { ...t, id: undefined, name: `${t.name} (کپی)` })}>کپی</button>
              <button className="btn sm danger" onClick={() => remove('templates', t.id)}>حذف</button>
            </div>
          </div>
        ))}
      </div>
      {tpl && <EditTemplate tpl={tpl} onClose={() => setEdit(undefined)} />}
      {use && <UseTemplate tpl={use} onClose={() => setUse(undefined)} />}
    </div>
  )
}

function EditTemplate({ tpl, onClose }: { tpl: Template; onClose: () => void }) {
  const set = (c: Partial<Template>) => update('templates', tpl.id, c)
  const setStep = (i: number, c: Partial<TemplateStep>) => set({ steps: tpl.steps.map((s, j) => (i === j ? { ...s, ...c } : s)) })
  return (
    <Modal wide title="ویرایش قالب" onClose={onClose} footer={<button className="btn primary" onClick={onClose}>تمام</button>}>
      <input className="input" value={tpl.name} onChange={(e) => set({ name: e.target.value })} placeholder="نام قالب" />
      <input className="input" value={tpl.description} onChange={(e) => set({ description: e.target.value })} placeholder="توضیح" />
      {tpl.steps.map((s, i) => (
        <div key={i} className="card col" style={{ padding: 10 }}>
          <div className="row">
            <strong>{faNum(i + 1)}.</strong>
            <input className="input grow" value={s.title} placeholder="عنوان مرحله" onChange={(e) => setStep(i, { title: e.target.value })} />
            <button className="btn ghost sm" disabled={i === 0} onClick={() => { const st = [...tpl.steps]; [st[i - 1], st[i]] = [st[i], st[i - 1]]; set({ steps: st }) }}>▲</button>
            <button className="btn ghost sm" disabled={i === tpl.steps.length - 1} onClick={() => { const st = [...tpl.steps]; [st[i + 1], st[i]] = [st[i], st[i + 1]]; set({ steps: st }) }}>▼</button>
            <button className="btn ghost sm danger" onClick={() => set({ steps: tpl.steps.filter((_, j) => j !== i) })}>✕</button>
          </div>
          <div className="row wrap small">
            <label className="row">شروع از روز <input type="number" min={0} className="input" style={{ width: 70 }} value={s.offsetDays} onChange={(e) => setStep(i, { offsetDays: Math.max(0, Number(e.target.value)) })} /></label>
            <label className="row">مدت (روز) <input type="number" min={1} className="input" style={{ width: 70 }} value={s.durationDays} onChange={(e) => setStep(i, { durationDays: Math.max(1, Number(e.target.value)) })} /></label>
            <label className="row">وزن <input type="number" min={1} max={10} className="input" style={{ width: 70 }} value={s.weight} onChange={(e) => setStep(i, { weight: Number(e.target.value) })} /></label>
          </div>
          <textarea className="input" style={{ minHeight: 50 }} placeholder="چک‌لیست (هر خط یک مورد)" value={s.checklist.join('\n')} onChange={(e) => setStep(i, { checklist: e.target.value.split('\n') })} />
        </div>
      ))}
      <button
        className="btn"
        onClick={() => {
          const last = tpl.steps.at(-1)
          set({ steps: [...tpl.steps, { ...blankStep(), offsetDays: last ? last.offsetDays + last.durationDays : 0 }] })
        }}
      >
        + مرحله‌ی جدید
      </button>
    </Modal>
  )
}

function UseTemplate({ tpl, onClose }: { tpl: Template; onClose: () => void }) {
  const nav = useNavigate()
  const [name, setName] = useState(tpl.name)
  const [start, setStart] = useState<string | undefined>(todayISO())
  return (
    <Modal
      title={`ساخت پروژه از «${tpl.name}»`}
      onClose={onClose}
      footer={
        <button
          className="btn primary"
          disabled={!name.trim() || !start}
          onClick={async () => {
            const p = await createProject(name.trim())
            await applyTemplate({ ...tpl, steps: tpl.steps.map((s) => ({ ...s, checklist: s.checklist.filter(Boolean) })) }, p, start!)
            nav(`/projects/${p.id}`)
          }}
        >
          ساخت
        </button>
      }
    >
      <label className="field"><span>نام پروژه</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="field"><span>تاریخ شروع</span><DateInput value={start} onChange={setStart} /></div>
    </Modal>
  )
}
