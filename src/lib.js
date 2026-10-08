export const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
export const uid = () => crypto.randomUUID()
export const key = (name) => name.trim().toLocaleLowerCase()
export const formatNumber = (value) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value)
export const formatDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
export const newSet = (source = {}) => ({ id: uid(), reps: source.reps ?? 10, weight: source.weight ?? 0, completed: false })
export const newExercise = (name = '') => ({ id: uid(), name, sets: [newSet(), newSet(), newSet()] })
export const newDraft = () => ({ name: 'My workout', date: today(), notes: '', duration: 0, startedAt: Date.now(), exercises: [newExercise()] })
export const draftStorageKey = user => `gymtrack.draft.v2:${user.id}`
function decode64(value) { return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0)) }
function encode64(value) { const bytes = new Uint8Array(value); let text = ''; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(text) }
async function draftCryptoKey(user) { if (!user?.id || !user?.draftKey) throw new Error('Sign in before accessing a draft.'); return crypto.subtle.importKey('raw', decode64(user.draftKey), 'AES-GCM', false, ['encrypt', 'decrypt']) }
export async function readDraft(user) {
  const raw = localStorage.getItem(draftStorageKey(user)); if (!raw) return null
  const record = JSON.parse(raw); const key = await draftCryptoKey(user)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode64(record.iv), additionalData: new TextEncoder().encode(user.id) }, key, decode64(record.ciphertext))
  const value = JSON.parse(new TextDecoder().decode(plain))
  if (value && typeof value.name === 'string' && Array.isArray(value.exercises) && value.exercises.length && value.exercises.every(e => typeof e.name === 'string' && Array.isArray(e.sets) && e.sets.length)) return value
  return null
}
let draftQueue = Promise.resolve()
export function writeDraft(user, value) {
  const snapshot = value ? JSON.stringify(value) : null
  const operation = draftQueue.then(async () => {
    if (!snapshot) { localStorage.removeItem(draftStorageKey(user)); return }
    const key = await draftCryptoKey(user); const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(user.id) }, key, new TextEncoder().encode(snapshot))
    localStorage.setItem(draftStorageKey(user), JSON.stringify({ version: 2, iv: encode64(iv), ciphertext: encode64(encrypted) }))
  })
  draftQueue = operation.catch(() => {}); return operation
}
let csrfToken = ''; let accountId = ''
export const setCsrfToken = value => { csrfToken = value || '' }
export const setAccountId = value => { accountId = value || '' }
export function completedSets(session) { return session.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.completed).map((set) => ({ ...set, name: exercise.name }))) }
export function volume(session) { return completedSets(session).reduce((sum, set) => sum + set.weight * set.reps, 0) }
export function records(sessions) {
  const map = new Map()
  for (const session of sessions) for (const set of completedSets(session)) {
    const nameKey = key(set.name)
    const previous = map.get(nameKey)
    const estimate = set.reps <= 10 && set.weight > 0 ? set.weight * (1 + set.reps / 30) : null
    const best = previous ?? { name: set.name, weight: -1, reps: 0, date: '', estimate: null }
    if (set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps)) { best.weight = set.weight; best.reps = set.reps; best.date = session.date }
    if (estimate !== null && (best.estimate === null || estimate > best.estimate)) best.estimate = estimate
    map.set(nameKey, best)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}
export function exerciseTrend(sessions, name) {
  const dates = new Map()
  for (const session of sessions) for (const exercise of session.exercises.filter((e) => key(e.name) === key(name))) {
    const sets = exercise.sets.filter((set) => set.completed)
    if (sets.length) dates.set(session.date, Math.max(dates.get(session.date) ?? 0, ...sets.map((set) => set.weight)))
  }
  return [...dates].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date))
}
export async function request(path, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`/api/${path}`, { ...options, credentials: 'same-origin', signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-GymTrack-CSRF': csrfToken } : {}), ...(accountId ? { 'X-GymTrack-Account': accountId } : {}), ...options.headers } })
    const data = await response.json().catch(() => ({}))
    if (response.status === 401 && typeof window !== 'undefined' && !path.startsWith('auth/')) window.dispatchEvent(new Event('gymtrack:expired'))
    if (!response.ok) throw new Error(data.message || 'The request failed. Please try again.')
    return data
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The server took too long to respond. Your draft is still here.', { cause: error })
    if (error instanceof TypeError) throw new Error('Cannot reach the server. Check that the backend is running.', { cause: error })
    throw error
  } finally { clearTimeout(timeout) }
}
export function download(data, filename, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const EXERCISES = ['Barbell bench press', 'Dumbbell bench press', 'Incline dumbbell press', 'Squat', 'Deadlift', 'Romanian deadlift', 'Leg press', 'Pull-up', 'Lat pulldown', 'Barbell row', 'Seated cable row', 'Overhead press', 'Lateral raise', 'Biceps curl', 'Triceps pushdown', 'Leg curl', 'Leg extension', 'Calf raise', 'Push-up', 'Hip thrust']
