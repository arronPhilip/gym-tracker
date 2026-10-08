import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { draftStorageKey, readDraft, writeDraft } from './lib.js'
const values = new Map()
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
const first = { id: 'account-a', draftKey: randomBytes(32).toString('base64url') }
const second = { id: 'account-b', draftKey: randomBytes(32).toString('base64url') }
const draft = { name: 'Private workout', notes: 'Secret training note', exercises: [{ name: 'Bench Press', sets: [{ reps: 8, weight: 50, completed: false }] }] }
test('drafts are encrypted, recoverable only with their account key and not automatically shared', async () => {
  await writeDraft(first, draft)
  const stored = values.get(draftStorageKey(first)); assert.ok(!stored.includes('Private workout')); assert.ok(!stored.includes('Secret training note'))
  assert.deepEqual(await readDraft(first), draft); assert.equal(await readDraft(second), null)
  values.set(draftStorageKey(second), stored); await assert.rejects(() => readDraft(second)); values.delete(draftStorageKey(second))
  await assert.rejects(() => readDraft({ ...first, draftKey: second.draftKey }))
  await writeDraft(second, { ...draft, name: 'Second account workout' }); assert.equal((await readDraft(first)).name, 'Private workout')
  await writeDraft(first, null); assert.equal(await readDraft(first), null); assert.equal((await readDraft(second)).name, 'Second account workout')
})
test('queued draft saves preserve the latest value and support large templates', async () => {
  const large = { ...draft, notes: 'x'.repeat(150000) }
  await Promise.all([writeDraft(first, draft), writeDraft(first, large)])
  assert.equal((await readDraft(first)).notes.length, 150000)
})
