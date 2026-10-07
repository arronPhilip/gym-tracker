const mongoose = require('mongoose');
const Workout = require('./models/Workout');
const setSchema = new mongoose.Schema({ id: String, reps: Number, weight: Number, completed: Boolean }, { _id: false });
const exerciseSchema = new mongoose.Schema({ id: String, name: String, sets: [setSchema] }, { _id: false });
const sessionSchema = new mongoose.Schema({ name: String, date: String, notes: String, duration: Number, exercises: [exerciseSchema] }, { timestamps: true });
const routineSchema = new mongoose.Schema({ name: String, notes: String, exercises: [exerciseSchema] }, { timestamps: true });
const weightSchema = new mongoose.Schema({ date: String, weight: Number }, { timestamps: true });
const Session = mongoose.model('WorkoutSession', sessionSchema);
const Routine = mongoose.model('WorkoutRoutine', routineSchema);
const Bodyweight = mongoose.model('Bodyweight', weightSchema);
const models = { sessions: Session, routines: Routine, bodyweights: Bodyweight };
const mongoStore = {
  mode: 'mongodb',
  ready: () => mongoose.connection.readyState === 1,
  list: (type) => models[type].find().sort({ date: -1, createdAt: -1 }).lean(),
  create: async (type, data) => (await models[type].create(data)).toObject(),
  update: (type, id, data) => models[type].findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after', runValidators: true }).lean(),
  remove: (type, id) => models[type].findByIdAndDelete(id).lean(),
  legacy: () => Workout.find().sort({ date: -1 }).lean(),
};
function legacySession(workout) {
  const count = Math.max(1, Math.min(30, Math.floor(Number(workout.sets) || 1)));
  const rawDate = new Date(workout.date);
  return { _id: `legacy:${workout._id}`, legacy: true, name: workout.exercise || 'Earlier exercise', date: Number.isFinite(rawDate.getTime()) ? rawDate.toISOString().slice(0, 10) : '1970-01-01', notes: 'Earlier exercise log. Preserved unchanged; read-only.', duration: 0, exercises: [{ id: `legacy-${workout._id}`, name: workout.exercise || 'Earlier exercise', sets: Array.from({ length: count }, (_, i) => ({ id: String(i), reps: Number(workout.reps) || 0, weight: Number(workout.weight) || 0, completed: true })) }] };
}
function memoryStore(seed = {}) {
  const data = { sessions: [], routines: [], bodyweights: [], ...structuredClone(seed) };
  const id = () => require('node:crypto').randomBytes(12).toString('hex');
  return { mode: 'test', ready: () => true,
    list: async (type) => structuredClone(data[type]),
    create: async (type, value) => { const record = { ...structuredClone(value), _id: id(), createdAt: new Date().toISOString() }; data[type].push(record); return structuredClone(record); },
    update: async (type, key, value) => { const index = data[type].findIndex((record) => record._id === key); if (index < 0) return null; data[type][index] = { ...data[type][index], ...structuredClone(value) }; return structuredClone(data[type][index]); },
    remove: async (type, key) => { const index = data[type].findIndex((record) => record._id === key); return index < 0 ? null : data[type].splice(index, 1)[0]; },
    legacy: async () => [],
  };
}
module.exports = { mongoStore, memoryStore, legacySession };
