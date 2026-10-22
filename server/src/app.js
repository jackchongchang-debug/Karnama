import crypto from 'node:crypto'
import path from 'node:path'
import express from 'express'
import { sync } from './db.js'

const safeEqual = (a, b) => {
  const x = crypto.createHash('sha256').update(a).digest()
  const y = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(x, y)
}

export function createApp({ pool, password, staticDir }) {
  staticDir = staticDir && path.resolve(staticDir)
  if (!password) throw new Error('APP_PASSWORD is not set')
  const app = express()
  app.use(express.json({ limit: '25mb' }))

  app.post('/api/login', async (req, res) => {
    const { password: given, device } = req.body ?? {}
    if (typeof given !== 'string' || !safeEqual(given, password)) {
      await new Promise((r) => setTimeout(r, 800))
      return res.status(401).json({ error: 'رمز عبور اشتباه است' })
    }
    const token = crypto.randomBytes(32).toString('hex')
    await pool.query('INSERT INTO tokens (token, device) VALUES ($1, $2)', [token, String(device || 'device').slice(0, 100)])
    res.json({ token })
  })

  const auth = async (req, res, next) => {
    const token = (req.get('authorization') ?? '').replace(/^Bearer /, '')
    const { rowCount } = await pool.query('UPDATE tokens SET last_seen = now() WHERE token = $1', [token])
    if (!rowCount) return res.status(401).json({ error: '401: توکن نامعتبر است؛ دوباره وارد شوید' })
    next()
  }

  app.post('/api/sync', auth, async (req, res) => {
    const cursor = Number(req.body?.cursor) || 0
    res.json(await sync(pool, cursor, req.body?.changes))
  })

  app.post('/api/logout', auth, async (req, res) => {
    await pool.query('DELETE FROM tokens WHERE token = $1', [(req.get('authorization') ?? '').replace(/^Bearer /, '')])
    res.json({ ok: true })
  })

  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  if (staticDir) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }))
    // Single-page app: every other GET serves index.html.
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html'), { maxAge: 0 }))
  }

  app.use((err, _req, res, _next) => {
    console.error(err)
    res.status(500).json({ error: 'خطای داخلی سرور' })
  })
  return app
}
