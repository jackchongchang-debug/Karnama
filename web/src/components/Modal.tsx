import { useEffect, type ReactNode } from 'react'
import './Modal.css'

export default function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal card ${wide ? 'wide' : ''}`} role="dialog">
        <div className="modal-head">
          <h2 className="grow">{title}</h2>
          <button className="btn ghost" onClick={onClose} aria-label="بستن">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
