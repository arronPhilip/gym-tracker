const { randomUUID } = require('node:crypto');
class InputError extends Error { constructor(message) { super(message); this.status = 400; } }
function text(value, name, max, required = false) {
  if (typeof value !== 'string') { if (!required && value == null) return ''; throw new InputError(`${name} must be text.`); }
  const result = value.trim();
  if ((required && !result) || result.length > max) throw new InputError(`${name} must be ${required ? '1' : '0'}–${max} characters.`);
  return result;
}
function number(value, name, min, max, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new InputError(`${name} must be ${integer ? 'a whole number ' : ''}between ${min} and ${max}.`);
  return value;
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value || value < '1900-01-01' || value > '2100-12-31') throw new InputError('Enter a valid date between 1900 and 2100.');
  return value;
}
function exercises(value, routine = false) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) throw new InputError('Add between 1 and 30 exercises.');
  return value.map((exercise) => {
    if (!exercise || typeof exercise !== 'object') throw new InputError('Invalid exercise.');
    if (!Array.isArray(exercise.sets) || exercise.sets.length < 1 || exercise.sets.length > 30) throw new InputError('Each exercise needs 1–30 sets.');
    return { id: randomUUID(), name: text(exercise.name, 'Exercise name', 100, true), sets: exercise.sets.map((set) => {
      if (!set || typeof set !== 'object') throw new InputError('Invalid set.');
      if (set.completed != null && typeof set.completed !== 'boolean') throw new InputError('Set completion must be true or false.');
      return { id: randomUUID(), reps: number(set.reps, 'Reps', 1, 1000, true), weight: number(set.weight, 'Weight', 0, 2000), completed: routine ? false : set.completed !== false };
    }) };
  });
}
function session(body) {
  if (!body || typeof body !== 'object') throw new InputError('Invalid workout.');
  const result = { name: text(body.name, 'Workout name', 100, true), date: date(body.date), notes: text(body.notes, 'Notes', 2000), duration: number(body.duration ?? 0, 'Duration in minutes', 0, 2880), exercises: exercises(body.exercises) };
  if (!result.exercises.some((exercise) => exercise.sets.some((set) => set.completed))) throw new InputError('Complete at least one set before saving.');
  return result;
}
function routine(body) { return { name: text(body?.name, 'Routine name', 100, true), notes: text(body?.notes, 'Notes', 2000), exercises: exercises(body?.exercises, true) }; }
function bodyweight(body) { return { date: date(body?.date), weight: number(body?.weight, 'Bodyweight', 1, 600) }; }
function objectId(value) { if (!/^[a-f\d]{24}$/i.test(value)) throw new InputError('Invalid record ID.'); return value; }
module.exports = { InputError, session, routine, bodyweight, objectId };
