const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const mongoose = require('mongoose');
const { createApp } = require('./app');
const { mongoStore, memoryStore } = require('./store');
async function start() {
  const testMode = process.env.GYMTRACK_TEST_MODE === '1';
  if (!testMode) {
    if (!process.env.MONGO_URI) throw new Error('missing_config');
    const options = { serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false };
    try {
      await mongoose.connect(process.env.MONGO_URI, options);
    } catch (error) {
      if (error.code !== 'ECONNREFUSED' || !['querySrv', 'queryTxt'].includes(error.syscall) || process.env.MONGO_DNS_FALLBACK === '0') throw error;
      // Only this Node process changes resolver. Credentials never go to a DNS query.
      console.log('Default MongoDB DNS lookup was refused. Retrying with process-local public DNS; Windows network settings are unchanged.');
      await mongoose.disconnect();
      require('node:dns').setServers(['1.1.1.1', '8.8.8.8']);
      await mongoose.connect(process.env.MONGO_URI, options);
    }
  }
  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('invalid_port');
  const server = createApp(testMode ? memoryStore() : mongoStore).listen(port, '127.0.0.1', () => {
    console.log(`GymTrack running at http://127.0.0.1:${port} (${testMode ? 'isolated in-memory TEST mode' : 'MongoDB connected'}).`);
  });
  server.on('error', () => { console.error('Cannot start GymTrack. The local port may already be in use.'); process.exitCode = 1; mongoose.disconnect(); });
  async function stop() { server.close(); await mongoose.disconnect(); process.exit(0); }
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
start().catch(() => { console.error('GymTrack could not start. Check server/.env MONGO_URI, your internet connection and MongoDB access settings. Credentials have not been printed.'); process.exitCode = 1; });
