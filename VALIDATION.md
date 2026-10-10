# Deployment security/build patch — 8 October 2026

The first Render deployment of 587419d failed before startup because production-mode `npm ci` omitted Vite. The corrected build command explicitly includes frontend build dependencies and installs production-only backend dependencies.

The local deployment patch updates compatible dependencies without `npm audit fix --force` and replaces the development-only nodemon watcher with `node --watch`. Earlier local checks passed 29 tests, lint, and the Vite production build; rerun them after synchronizing the earlier-log deletion feature. These checks do not establish live Google login or make a real database write.

The earlier-log deletion update has not yet been deployed to Render.

---

# Protected multi-user release — 7 October 2026

Local automated validation is recorded below separately from the original release. Fresh direct checks passed: 29 tests, zero failures, clean ESLint and a successful Vite production build. The PowerShell npm wrapper stalled without output and was stopped; invoking the same installed tools directly completed successfully.

Multi-user checks use isolated in-memory storage and mocked Google token verification. They cover anonymous denial, two-account data isolation, owner-only legacy access, ownership-spoofing rejection, export isolation, CSRF/origin safeguards, Google issuer/audience/expiry checks, logout and encrypted per-account drafts. They do not establish live Google login, hosted secure cookies or Render-to-MongoDB connectivity. See DEPLOYMENT.md for the outstanding live release checks.

No hosted release is claimed. No old workout data was migrated or deleted by these code changes. New authentication collections/indexes will be created when the authenticated backend starts against MongoDB.

---

## Archived original personal release validation

# GymTrack validation — 7 October 2026

## Automated checks

- 14 tests passed, zero failed. Node's built-in test runner.
- ESLint passed with zero errors/warnings.
- Production bundle generated successfully with Vite's build API; clean process exit.
- No new runtime dependencies were required.

API tests use an explicitly injected in-memory store, never the user's MongoDB database. They cover session create/edit/delete, routine create/edit/delete and completion reset, bodyweight create/edit/delete, export, owner-only deletion of individual earlier logs, invalid values/dates/IDs, nonexistent records, foreign browser origins and excessive inputs.

Calculation tests cover completed-only volume, exercise-name grouping, daily best progression, records, tie-breaking, zero-weight exercises and empty data.

## Browser checks actually performed

- Inspected desktop dashboard at 1280px and intermediate layout at 966px.
- Started a workout; entered a name, exercise and weight; marked a set complete.
- Started a 60-second rest timer and observed its display.
- Reloaded, resumed the draft and verified its entered values/completed set remained.
- Saved that workout into isolated test storage; verified history showed 500 kg completed volume for 50 kg × 10 reps, while incomplete sets were excluded.
- Inspected progress charts and personal-record cards with clearly labelled synthetic test data.
- Inspected bodyweight chart/form/history and routine cards with synthetic test data.
- Started a saved routine and verified it created a draft containing two exercises with unchecked sets.
- Confirmed removal of test drafts using the dialog.
- Rendered the actual application in a 390px iframe (375px content viewport after scrollbar), inspecting the mobile dashboard and workout editor. Both had no horizontal overflow. Mobile export access was added during this check.
- Temporary mobile harness was deleted and its tab closed.

Browser editing/deletion/export-download flows were not each exhaustively exercised. Their API operations and relevant calculations were tested. No real phone, assistive-technology suite, or full cross-browser test was performed.

## Live MongoDB checks (read-only)

- Existing `server/.env` configuration was retained; its credentials were not printed or modified.
- The machine's default SRV DNS query failed with `ECONNREFUSED` / `querySrv`.
- A process-local public DNS retry connected successfully; the backend includes this narrow fallback. Windows DNS settings were not changed.
- Live `/api/health` reported `{ ok: true, mode: "mongodb" }`.
- Live history returned 7 preserved earlier exercise logs, 0 new full sessions, 0 routines and 0 bodyweight entries.
- No synthetic test workout names were present in the live data.
- No real database records were created, changed, migrated or deleted during validation. Live MongoDB write persistence is therefore not claimed as end-to-end verified; write flows were checked against the in-memory API tests.

## Release scope and limitations

Personal local-only website, not a hosted or multi-user production release. No authentication, native mobile app, public hosting, automatic migration, data import, scheduled backups or browser notifications are included. Draft recovery is browser/device-local; routine-editor changes and the rest timer are not recovered after a reload. Exercise aliases are not automatically merged. Only kg is supported.

The original source was backed up in this Strawberry chat before editing, excluding credentials, Git internals and dependencies. Existing `client/` files and the user's uncommitted changes are retained. See README for startup commands and safeguards.
