import { useEffect, useState } from 'react'

export default function Toasts() {
  const [items, setItems] = useState<{ id: number; text: string }[]>([])
  useEffect(() => {
    const on = (e: Event) => {
      const id = Date.now() + Math.random()
      setItems((s) => [...s, { id, text: (e as CustomEvent<string>).detail }])
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 8000)
    }
    window.addEventListener('karnama:toast', on)
    return () => window.removeEventListener('karnama:toast', on)
  }, [])
  return (
    <div className="toasts">
      {items.map((t) => (
        <div key={t.id} className="card toast" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}>{t.text}</div>
      ))}
    </div>
  )
}
