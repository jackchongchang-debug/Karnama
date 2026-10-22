import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { createPool, migrate } from '../src/db.js'

const url = process.env.TEST_DATABASE_URL
let pool, server, base

before(async () => {
  if (!url) return
  pool = createPool(url)
  await pool.query('DROP TABLE IF EXISTS records, tokens; DROP SEQUENCE IF EXISTS records_seq_gen')
  await migrate(pool)
  server = createApp({ pool, password: 'secret' }).listen(0)
  base = `http://localhost:${server.address().port}`
})

after(async () => {
  server?.close()
  await pool?.end()
})

const post = async (path, body, token) => {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

test('rejects a wrong password and unauthenticated sync', { skip: !url }, async () => {
  assert.equal((await post('/api/login', { password: 'nope' })).status, 401)
  assert.equal((await post('/api/sync', { cursor: 0, changes: {} }, 'bad')).status, 401)
})

test('two devices converge, newest write wins, deletes propagate', { skip: !url }, async () => {
  const a = (await post('/api/login', { password: 'secret', device: 'phone' })).body.token
  const b = (await post('/api/login', { password: 'secret', device: 'laptop' })).body.token

  const task = { id: 't1', updatedAt: 1000, deleted: 0, title: 'from phone' }
  let ra = await post('/api/sync', { cursor: 0, changes: { tasks: [task] } }, a)
  assert.equal(ra.status, 200)

  let rb = await post('/api/sync', { cursor: 0, changes: {} }, b)
  assert.deepEqual(rb.body.changes.tasks, [task])
  const cursorB = rb.body.cursor

  // An older edit from the laptop loses; a newer one wins.
  await post('/api/sync', { cursor: cursorB, changes: { tasks: [{ ...task, updatedAt: 500, title: 'stale' }] } }, b)
  ra = await post('/api/sync', { cursor: ra.body.cursor, changes: {} }, a)
  assert.deepEqual(ra.body.changes, {})

  await post('/api/sync', { cursor: cursorB, changes: { tasks: [{ ...task, updatedAt: 2000, title: 'from laptop', deleted: 1 }] } }, b)
  ra = await post('/api/sync', { cursor: ra.body.cursor, changes: {} }, a)
  assert.equal(ra.body.changes.tasks[0].title, 'from laptop')
  assert.equal(ra.body.changes.tasks[0].deleted, 1)

  // Unknown tables are ignored.
  const r = await post('/api/sync', { cursor: 0, changes: { evil: [{ id: 'x', updatedAt: 1 }] } }, a)
  assert.equal(r.body.changes.evil, undefined)
})
