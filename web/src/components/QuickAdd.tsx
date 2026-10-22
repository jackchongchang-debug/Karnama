import { useState } from 'react'

export default function QuickAdd({ onAdd, placeholder = '+ افزودن وظیفه' }: { onAdd: (title: string) => void; placeholder?: string }) {
  const [title, setTitle] = useState('')
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) { onAdd(title.trim()); setTitle('') } }}>
      <input className="input" placeholder={placeholder} value={title} onChange={(e) => setTitle(e.target.value)} />
    </form>
  )
}
