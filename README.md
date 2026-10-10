# GymTrack

A Google-authenticated, multi-user workout website built with React + Vite, Express and MongoDB. Modern charcoal/green design with responsive desktop, tablet and narrow-screen layouts.

## Start on this computer

Open PowerShell and run:

```powershell
cd C:\Users\Lenovo\gym-tracker
npm run dev
```

Keep that terminal open. Open **http://127.0.0.1:5173** in your browser. Press **Ctrl+C** in the terminal to stop both the website and backend.

The assistant-run preview is temporary and may stop when its execution environment closes or times out. For normal use, run the command in your own PowerShell terminal. Stop any existing assistant preview first (ask Strawberry to stop it), otherwise the ports will already be in use.

The existing `server/.env` file is used. It must contain `MONGO_URI`, a dedicated `GOOGLE_CLIENT_ID`, and `LEGACY_OWNER_EMAIL` for access to pre-existing records. Google sign-in must be configured before you can access workouts; there is no unauthenticated local bypass. Never put that connection string in frontend code, screenshots, chat, or Git. A template is available in `server/.env.example`.

Dependencies are already installed on this computer. On a fresh checkout:

```powershell
npm install
npm --prefix server install
```

Then privately create `server/.env` from the example before starting.

## Features

- Full workout sessions: name, date, multiple exercises, individual-set reps/weight/completion, notes and duration.
- Recoverable, per-account encrypted active workout draft in this browser's local storage. Refresh and choose Resume your workout.
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

The original `workouts` collection remains in its original format; no automatic migration or edits are made. Its records appear in history as **Earlier log** and contribute to volume, exercise progress and records, but not the count of full sessions. The verified legacy owner can permanently delete an individual earlier log from history after confirmation. This removes it from the original collection, exports and progress calculations. New data uses `workoutsessions`, `workoutroutines` and `bodyweights` collections.

The old `client/` files are retained for reference, including the user's uncommitted changes. The active website is now in `src/`. Old `/workouts` endpoints are retired; the new website uses `/api/` routes. No automatic database migration runs at startup.

## Privacy and authentication

Google sign-in is verified on the server. Public signup accepts verified Gmail and Google Workspace identities, but each account can only access its own sessions, routines, bodyweight and exports. The configured verified legacy-owner email alone can access the original earlier workouts and pre-existing unowned records. Startup does not migrate, edit or automatically delete old data; an earlier workout is removed only when the owner explicitly confirms its deletion. Other third-party email Google accounts are currently not accepted.

Opaque session cookies are HttpOnly; production cookies require HTTPS and use Secure, SameSite=Strict and the __Host- prefix. Account headers prevent stale-tab access after an account switch. Writes require anti-forgery tokens and allowed origins. Sessions expire after seven days and logout revokes them in MongoDB. Sign-in attempts are rate-limited in memory, which resets on restart; this is not a distributed abuse prevention system.

Both processes bind to 127.0.0.1 locally. Production binds to the platform port and requires an HTTPS origin and legacy-owner configuration. Missing login-client configuration leaves data locked. Render, Google and MongoDB setup plus live sign-in testing are still required before calling the hosted release ready.

Unfinished drafts are encrypted with AES-GCM, stored separately for each account on the device, and unavailable through the signed-out interface. Their keys are held with the account in MongoDB; encryption is not protection against malicious software, an unlocked active account or a compromised database. Old v1 drafts are not imported. Drafts are not cloud-synced or included in exports; clearing browser storage removes them. Routine-editor changes and the timer are not recovered. JSON export is a download, not an automatic backup; import and automatic account deletion are not included. Privacy information is available at /privacy.

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

## Render Free deployment

See `DEPLOYMENT.md` for the protected release configuration and verification checklist. Never deploy an earlier unprotected commit. No paid plan or payment method is required by this project configuration; inspect the provider account and plan before creating the service.
