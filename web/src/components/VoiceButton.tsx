import { useEffect, useRef, useState } from 'react'

interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type RecognitionCtor = new () => Recognition

const Ctor: RecognitionCtor | undefined =
  (window as unknown as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition

export const speechSupported = !!Ctor

const ERRORS: Record<string, string> = {
  'not-allowed': 'اجازه‌ی دسترسی به میکروفون داده نشد',
  'no-speech': 'صدایی شنیده نشد',
  network: 'تبدیل صدا به اینترنت نیاز دارد',
  'audio-capture': 'میکروفونی پیدا نشد',
}

/**
 * Dictation through the browser's speech recognition (Persian). Each finished phrase is passed to
 * `onText`; `onInterim` receives the phrase still being spoken, for a live preview.
 */
export default function VoiceButton({ onText, onInterim }: { onText: (text: string) => void; onInterim?: (text: string) => void }) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const rec = useRef<Recognition | null>(null)
  const cb = useRef({ onText, onInterim })
  useEffect(() => {
    cb.current = { onText, onInterim }
  })
  useEffect(() => () => rec.current?.stop(), [])

  const start = () => {
    if (!Ctor) return
    setError('')
    const r = new Ctor()
    r.lang = 'fa-IR'
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) cb.current.onText(res[0].transcript.trim())
        else interim += res[0].transcript
      }
      cb.current.onInterim?.(interim)
    }
    r.onerror = (e) => setError(ERRORS[e.error] ?? `خطا در تشخیص گفتار (${e.error})`)
    r.onend = () => {
      setListening(false)
      cb.current.onInterim?.('')
    }
    rec.current = r
    r.start()
    setListening(true)
  }

  if (!Ctor) return <span className="small muted">این مرورگر از تبدیل صدا به متن پشتیبانی نمی‌کند (کروم یا اج را امتحان کنید).</span>

  return (
    <span className="row">
      <button
        type="button"
        className={`btn sm ${listening ? 'danger' : ''}`}
        onClick={() => (listening ? rec.current?.stop() : start())}
      >
        {listening ? '■ توقف ضبط' : '🎤 گفتن با صدا'}
      </button>
      {listening && <span className="small muted">در حال گوش دادن…</span>}
      {error && <span className="small" style={{ color: 'var(--danger)' }}>{error}</span>}
    </span>
  )
}
