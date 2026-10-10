# Protected GymTrack deployment

Status: the Render Free service `gymtrack-arron` has been deployed and `/api/health` was verified in MongoDB mode. Google sign-in still needs an end-to-end check: the hosted origin was rejected by the Google OAuth client. The earlier-log deletion update is pending a Render deployment.

## Render web service
- Source: https://github.com/arronPhilip/gym-tracker, branch main, protected release only.
- Runtime: Node; use Node 22.22 or a newer supported Node 22 release.
- Repository root: leave blank.
- Build: npm ci --include=dev && npm --prefix server ci --omit=dev && npm run build
- Start: npm start
- Health check: /api/health
- Instance: Free only. No card, paid database, persistent disk or paid upgrade.
- Manual deployments from the public Git repository avoid granting extra GitHub permissions. Confirm the final deployed commit.

## Private environment configuration
- NODE_ENV=production
- MONGO_URI: existing connection string, provided directly in Render's secret environment settings. Never source-control or print it.
- GOOGLE_CLIENT_ID: dedicated Web application OAuth client (public identifier, not a client secret).
- LEGACY_OWNER_EMAIL: Arron's verified Google email, set privately in service environment, not embedded in application source.
- APP_ORIGIN: exact HTTPS service URL, or rely on Render's RENDER_EXTERNAL_URL.
- PORT: use Render's supplied value. Do not copy local PORT=5000 into the hosting environment.

Google Identity Services ID-token verification does not require an OAuth client secret. Configure the Google application name, support/developer contact and external audience in the approved project. Add only the exact hosted HTTPS origin to the Web client. Local testing can separately use http://localhost:5000 and http://localhost:5173. No wildcard origins and no unrelated API scopes.

## MongoDB access
Verify the existing cluster tier and account first. Prefer adding only Render's published outbound IP ranges for the selected service region, retaining existing legitimate entries. These can be shared with other Render services, so they are narrower than world access but not dedicated private networking. A deployment cannot connect until the database access list allows its outbound traffic. Do not add 0.0.0.0/0 or change database users without explicit approval. Use a database user limited to the GymTrack database where possible; inspect existing privileges first. Never reset an existing user's credentials blindly.

## Release checks
1. Tests, lint and build pass; source manifest excludes .env, Git metadata, dependencies and build output.
2. Signed-out API calls for sessions, routines, bodyweight and export return 401 and reveal no data.
3. Health and privacy pages load over HTTPS.
4. Live Google login works for the owner; earlier logs and the reviewed TEST — Push Workout routine remain intact unless the owner explicitly deletes an individual earlier log.
5. A separately approved second account sees empty private data, not Arron's records. Do not create fake Google identities or log into another person's account.
6. CSRF/origin checks, account-switch rejection, logout, expiry and secure cookies are tested. Automated mock checks do not establish live Google or MongoDB correctness.
7. Do not create completed test workouts in the real database without explicit approval. Keep backups/export copies under the user's control.

## Limitations
Early project, not an audited security product. Public signup currently supports verified Gmail/Workspace identities only. Free hosting may sleep and restart; see current provider terms. Google branding or production publication can require additional review. No automated account deletion/recovery, database backup, import, monitoring or distributed rate limiting. A one-instance deployment is assumed; confirm before scaling.
