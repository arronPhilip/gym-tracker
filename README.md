# GymTrack

A personal, local-only workout website built with React + Vite, Express and MongoDB. Modern charcoal/green design with responsive desktop, tablet and narrow-screen layouts.

## Start on this computer

Open PowerShell and run:

```powershell
cd C:\Users\Lenovo\gym-tracker
npm run dev
```

Keep that terminal open. Open **http://127.0.0.1:5173** in your browser. Press **Ctrl+C** in the terminal to stop both the website and backend.

The assistant-run preview is temporary and may stop when its execution environment closes or times out. For normal use, run the command in your own PowerShell terminal. Stop any existing assistant preview first (ask Strawberry to stop it), otherwise the ports will already be in use.

The existing `server/.env` file is used. It must contain `MONGO_URI`. Never put that connection string in frontend code, screenshots, chat, or Git. A template is available in `server/.env.example`.

Dependencies are already installed on this computer. On a fresh checkout:

```powershell
npm install
npm --prefix server install
```

Then privately create `server/.env` from the example before starting.

## Features

- Full workout sessions: name, date, multiple exercises, individual-set reps/weight/completion, notes and duration.
- Recoverable active workout draft in this browser's local storage. Refresh and choose Resume your workout.
- Exercise suggestions and custom exercise names; add/remove sets and exercises.
- Reusable routines with target sets, reps and weights; create/edit/delete/start a routine.
- Rest timers for 60/90/120 seconds, add 30 seconds, and dismiss.
- Searchable session history, detailed set breakdown, editing, and confirmed deletion.
- Daily heaviest-set charts, heaviest-set personal records and approximate Epley one-rep-max estimates.
- Bodyweight entry, date selection, edit/delete, chart and history.
- Full JSON export of sessions, routines, bodyweight and original earlier logs; workout CSV export.
- Clear loading, offline/error and empty states; strict API input validation; text-safe React rendering.

All weights are in **kg**. Only completed sets count towards training volume and strength progress. Zero weight means unweighted/bodyweight exercise; its volume is zero. Exercise grouping ignores case and leading/trailing spaces, but does not merge aliases such as `Bench press` and `Barbell bench press`.

## Existing MongoDB records

The original `workouts` collection is preserved unchanged. Its records appear as **Earlier log · read-only**. They contribute to volume, exercise progress and records, but not the count of full sessions. They are not silently converted, updated or deleted. New data uses `workoutsessions`, `workoutroutines` and `bodyweights` collections.

The old `client/` files are retained for reference, including the user's uncommitted changes. The active website is now in `src/`. Old `/workouts` endpoints are retired; the new website uses `/api/` routes. No automatic database migration runs at startup.

## Privacy and local scope

There is **no signup/login** in this personal release. Both processes bind to `127.0.0.1`, not the network. Do not publish it or expose it using a tunnel without adding authentication, user-specific data, hosting safeguards and HTTPS. It is not a native mobile app; phone-sized layouts are responsive, but another device cannot connect to this loopback-only server.

Workouts/routines/bodyweight are stored in MongoDB once saved. An unfinished workout draft stays on this browser/device; it is not cloud-synced and is not included in exports. Clearing browser storage removes that draft. Routine editor changes are not recoverable drafts. The rest timer is not preserved after reload and does not provide a sound or background notification. JSON export is a download, not a scheduled backup; import is not included.

On this machine the default MongoDB SRV DNS lookup was refused. A narrow fallback retries **only** an `ECONNREFUSED` `querySrv`/`queryTxt` failure using DNS servers `1.1.1.1` and `8.8.8.8` in the backend's Node process. This does not change Windows DNS settings or transmit database credentials to DNS. Set `MONGO_DNS_FALLBACK=0` in `server/.env` if you prefer to disable this fallback.

## Tests and production bundle

```powershell
npm test
npm run lint
npm run build
```

To run a safe, empty, isolated test preview **instead of** the real server:

```powershell
npm run test:demo
```

This uses in-memory test storage and shows a warning banner. Its saved data disappears when the test server stops. Do not run real and test servers simultaneously on the same ports.

For a local bundled build:

```powershell
npm run build
npm start
```

Open **http://127.0.0.1:5000**. The backend serves the generated `dist` website directly. `npm run preview` is not used because it would not provide the MongoDB API proxy.

See `VALIDATION.md` for the checks actually performed and remaining limitations.
