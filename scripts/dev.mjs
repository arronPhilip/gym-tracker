import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const testMode = process.argv.includes('--test')
const children = [spawn(process.execPath, ['server/index.js'], { cwd: root, stdio: 'inherit', env: { ...process.env, ...(testMode ? { GYMTRACK_TEST_MODE: '1' } : {}) } }), spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: root, stdio: 'inherit' })]
let stopping = false
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill(); process.exitCode = code }
for (const child of children) { child.on('exit', (code) => stop(code || 0)); child.on('error', () => { console.error('Unable to start a development process. Check dependencies.'); stop(1) }) }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop())
