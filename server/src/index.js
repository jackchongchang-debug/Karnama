import { createApp } from './app.js'
import { createPool, migrate } from './db.js'

const pool = createPool()
await migrate(pool)
const app = createApp({ pool, password: process.env.APP_PASSWORD, staticDir: process.env.STATIC_DIR })
const port = Number(process.env.PORT) || 4000
app.listen(port, () => console.log(`karnama server listening on :${port}`))
