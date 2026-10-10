const mongoose = require('mongoose');
const Workout = require('./models/Workout');
const setSchema = new mongoose.Schema({ id: String, reps: Number, weight: Number, completed: Boolean }, { _id: false });
const exerciseSchema = new mongoose.Schema({ id: String, name: String, sets: [setSchema] }, { _id: false });
const sessionSchema = new mongoose.Schema({ ownerId: { type: String, index: true }, name: String, date: String, notes: String, duration: Number, exercises: [exerciseSchema] }, { timestamps: true });
const routineSchema = new mongoose.Schema({ ownerId: { type: String, index: true }, name: String, notes: String, exercises: [exerciseSchema] }, { timestamps: true });
const weightSchema = new mongoose.Schema({ ownerId: { type: String, index: true }, date: String, weight: Number }, { timestamps: true });
const Session = mongoose.models.WorkoutSession || mongoose.model('WorkoutSession', sessionSchema);
const Routine = mongoose.models.WorkoutRoutine || mongoose.model('WorkoutRoutine', routineSchema);
const Bodyweight = mongoose.models.Bodyweight || mongoose.model('Bodyweight', weightSchema);
const models = { sessions: Session, routines: Routine, bodyweights: Bodyweight };
function scopeFilter(scope) {
  if (!scope || typeof scope.userId !== 'string' || !scope.userId) throw new Error('Account scope is required.');
  return scope.legacy ? { $or: [{ ownerId: scope.userId }, { ownerId: { $exists: false } }] } : { ownerId: scope.userId };
}
const mongoStore = {
  mode: 'mongodb', ready: () => mongoose.connection.readyState === 1,
  list: (type, scope) => models[type].find(scopeFilter(scope)).sort({ date: -1, createdAt: -1 }).lean(),
  create: async (type, data, scope) => { scopeFilter(scope); return (await models[type].create({ ...data, ownerId: scope.userId })).toObject(); },
  update: (type, id, data, scope) => models[type].findOneAndUpdate({ _id: id, ...scopeFilter(scope) }, { $set: { ...data, ownerId: scope.userId } }, { returnDocument: 'after', runValidators: true }).lean(),
  remove: (type, id, scope) => models[type].findOneAndDelete({ _id: id, ...scopeFilter(scope) }).lean(),
  legacy: (scope) => { scopeFilter(scope); return scope.legacy ? Workout.find().sort({ date: -1 }).lean() : Promise.resolve([]); },
  removeLegacy: (id, scope) => { scopeFilter(scope); return scope.legacy ? Workout.findOneAndDelete({ _id: id }).lean() : Promise.resolve(null); },
};
function legacySession(workout) {
  const count = Math.max(1, Math.min(30, Math.floor(Number(workout.sets) || 1)));
  const rawDate = new Date(workout.date);
  return { _id: `legacy:${workout._id}`, legacy: true, name: workout.exercise || 'Earlier exercise', date: Number.isFinite(rawDate.getTime()) ? rawDate.toISOString().slice(0, 10) : '1970-01-01', notes: 'Earlier exercise log. Preserved unchanged; read-only.', duration: 0, exercises: [{ id: `legacy-${workout._id}`, name: workout.exercise || 'Earlier exercise', sets: Array.from({ length: count }, (_, i) => ({ id: String(i), reps: Number(workout.reps) || 0, weight: Number(workout.weight) || 0, completed: true })) }] };
}
function memoryStore(seed = {}) {
  const data = { sessions: [], routines: [], bodyweights: [], legacy: [], ...structuredClone(seed) };
  const id = () => require('node:crypto').randomBytes(12).toString('hex');
  const owns = (record, scope) => { scopeFilter(scope); return record.ownerId === scope.userId || (scope.legacy && record.ownerId === undefined); };
  return { mode: 'test', ready: () => true,
    list: async (type, scope) => { scopeFilter(scope); return structuredClone(data[type].filter(r => owns(r, scope))); },
    create: async (type, value, scope) => { scopeFilter(scope); const record = { ...structuredClone(value), ownerId: scope.userId, _id: id(), createdAt: new Date().toISOString() }; data[type].push(record); return structuredClone(record); },
    update: async (type, key, value, scope) => { scopeFilter(scope); const index = data[type].findIndex(record => record._id === key && owns(record, scope)); if (index < 0) return null; data[type][index] = { ...data[type][index], ...structuredClone(value), ownerId: scope.userId }; return structuredClone(data[type][index]); },
    remove: async (type, key, scope) => { scopeFilter(scope); const index = data[type].findIndex(record => record._id === key && owns(record, scope)); return index < 0 ? null : data[type].splice(index, 1)[0]; },
    legacy: async scope => { scopeFilter(scope); return scope.legacy ? structuredClone(data.legacy) : []; },
    removeLegacy: async (key, scope) => { scopeFilter(scope); if (!scope.legacy) return null; const index = data.legacy.findIndex(record => record._id === key); return index < 0 ? null : data.legacy.splice(index, 1)[0]; },
  };
}
module.exports = { mongoStore, memoryStore, legacySession, scopeFilter };
