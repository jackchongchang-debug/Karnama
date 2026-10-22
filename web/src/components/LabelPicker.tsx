import { useState } from 'react'
import { create } from '../lib/db'
import { useLabels } from '../lib/hooks'
import { PROJECT_COLORS } from '../lib/tasks'

export function LabelChips({ ids }: { ids: string[] }) {
  const labels = useLabels()
  return (
    <>
      {ids.map((id) => {
        const l = labels.find((x) => x.id === id)
        return l ? <span key={id} className="chip" style={{ background: l.color + '22', color: l.color }}>{l.name}</span> : null
      })}
    </>
  )
}

export default function LabelPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const labels = useLabels()
  const [name, setName] = useState('')
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  return (
    <div className="row wrap">
      {labels.map((l) => (
        <button
          key={l.id}
          type="button"
          className="chip"
          style={{ cursor: 'pointer', border: `1px solid ${l.color}`, background: value.includes(l.id) ? l.color : 'transparent', color: value.includes(l.id) ? '#fff' : l.color }}
          onClick={() => toggle(l.id)}
        >
          {l.name}
        </button>
      ))}
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          const l = await create('labels', { name: name.trim(), color: PROJECT_COLORS[labels.length % PROJECT_COLORS.length] })
          onChange([...value, l.id])
          setName('')
        }}
      >
        <input className="input" style={{ width: 130, padding: '2px 8px' }} placeholder="برچسب جدید" value={name} onChange={(e) => setName(e.target.value)} />
      </form>
    </div>
  )
}
