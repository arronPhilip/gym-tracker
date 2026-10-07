import { test } from 'node:test'
import assert from 'node:assert/strict'
import { completedSets, exerciseTrend, records, volume } from './lib.js'
const sessions = [
  { date: '2026-10-01', exercises: [{ name: 'Bench press', sets: [{ reps: 8, weight: 50, completed: true }, { reps: 1, weight: 200, completed: false }] }] },
  { date: '2026-10-03', exercises: [{ name: ' bench PRESS ', sets: [{ reps: 6, weight: 55, completed: true }, { reps: 8, weight: 55, completed: true }] }] },
  { date: '2026-10-03', exercises: [{ name: 'Bench press', sets: [{ reps: 1, weight: 57.5, completed: true }] }] },
]
test('only completed sets contribute to volume', () => { assert.equal(completedSets(sessions[0]).length, 1); assert.equal(volume(sessions[0]), 400) })
test('records ignore incomplete sets and normalise exercise names', () => { const result = records(sessions); assert.equal(result.length, 1); assert.equal(result[0].weight, 57.5); assert.equal(result[0].reps, 1); assert.ok(Math.abs(result[0].estimate - 55 * (1 + 8 / 30)) < .001) })
test('progress uses the daily maximum and sorts dates', () => { assert.deepEqual(exerciseTrend([...sessions].reverse(), 'BENCH PRESS'), [{ date: '2026-10-01', value: 50 }, { date: '2026-10-03', value: 57.5 }]) })
test('zero-weight and empty sessions produce truthful statistics', () => { const zero = { date: '2026-10-01', exercises: [{ name: 'Push-up', sets: [{ reps: 10, weight: 0, completed: true }] }] }; assert.equal(volume(zero), 0); assert.equal(records([zero])[0].estimate, null); assert.deepEqual(records([]), []); assert.deepEqual(exerciseTrend([], 'Test'), []) })
test('record ties prefer higher repetitions', () => { assert.equal(records(sessions.slice(0, 2))[0].reps, 8) })
