import { useId, useState } from 'react'

/** Free-form keyword chips: type and press Enter or comma to add. */
export default function TagInput({ value, onChange, suggestions = [] }: { value: string[]; onChange: (v: string[]) => void; suggestions?: string[] }) {
  const [text, setText] = useState('')
  const listId = useId()
  const add = (raw: string) => {
    const tags = raw.split(/[,،]/).map((t) => t.trim()).filter((t) => t && !value.includes(t))
    if (tags.length) onChange([...value, ...tags])
    setText('')
  }
  return (
    <div className="input row wrap" style={{ gap: 4, padding: 4 }}>
      {value.map((t) => (
        <span key={t} className="chip" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
          {t}
          <button type="button" className="btn ghost sm" style={{ padding: 0 }} onClick={() => onChange(value.filter((x) => x !== t))} aria-label="حذف">✕</button>
        </span>
      ))}
      <input
        list={listId}
        style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, minWidth: 120 }}
        placeholder={value.length ? '' : 'کلمه‌ی کلیدی و Enter'}
        value={text}
        onChange={(e) => (/[,،]$/.test(e.target.value) ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(text) }
          if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={() => text && add(text)}
      />
      <datalist id={listId}>{suggestions.filter((s) => !value.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
    </div>
  )
}
