import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './components'
import { request, setCsrfToken, setAccountId } from './lib'

function GoogleButton({ clientId, onCredential, onError }) {
  const element = useRef(null)
  const handler = useRef(onCredential)
  useEffect(() => { handler.current = onCredential }, [onCredential])
  useEffect(() => {
    let active = true
    function render() {
      if (!active || !element.current || !window.google?.accounts?.id) return
      window.google.accounts.id.initialize({ client_id: clientId, callback: response => handler.current(response.credential), auto_select: false })
      window.google.accounts.id.renderButton(element.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: Math.min(280, Math.max(200, Math.floor(element.current.clientWidth))) })
    }
    let script = document.querySelector('script[data-gymtrack-google]')
    if (!script) { script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true; script.dataset.gymtrackGoogle = 'true'; document.head.appendChild(script) }
    const failed = () => { if (active) onError('Google sign-in could not load. Check your connection or browser blocking settings.') }
    if (window.google?.accounts?.id) render()
    else script.addEventListener('load', render)
    script.addEventListener('error', failed)
    return () => { active = false; script.removeEventListener('load', render); script.removeEventListener('error', failed) }
  }, [clientId, onError])
  return <div className="google-button" ref={element} />
}
export function PrivacyPage() {
  return <main className="auth-screen"><section className="card privacy-card"><a className="text-button" href="/">← Back to GymTrack</a><h1>Privacy at GymTrack</h1><p>GymTrack uses Google sign-in to identify your account. It stores your Google account identifier, verified email, display name and the workout, routine and bodyweight information you choose to save.</p><h2>Your training stays private</h2><p>Saved data is stored in MongoDB. Other GymTrack users cannot access your workouts, routines, bodyweight or exports. An unfinished draft is encrypted and stored in this browser, separately for each account. It is not a cloud backup.</p><h2>Cookies and providers</h2><p>Essential secure session and anti-forgery cookies keep you signed in and protect writes. Google handles sign-in; Render hosts the website and MongoDB Atlas stores saved data. These providers process service data under their own policies. GymTrack does not store your Google password or request Gmail, Calendar or Drive access.</p><h2>Your controls</h2><p>You can export your data, edit or delete saved entries, and discard an unfinished draft. Earlier personal logs remain read-only. Automated account deletion is not yet available. Contact the project owner through the repository if you need assistance, but do not post passwords, identity tokens or private workout details in public issues.</p><p>This is an early personal project, not medical advice or a clinical record system. Free hosting can pause or become temporarily unavailable. Do not rely on it as your only backup.</p><a href="https://github.com/arronPhilip/gym-tracker">Project repository</a></section></main>
}
export function AuthBoundary({ children }) {
  const [auth, setAuth] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try { const value = await request('auth/session'); setCsrfToken(value.csrfToken); setAccountId(value.user?.id); setAuth(value); setError('') }
    catch (err) { setCsrfToken(''); setAccountId(''); setError(err.message); setAuth({ user: null, ready: false }) }
  }, [])
  useEffect(() => { const timer = setTimeout(() => { void load() }, 0); const expired = () => { setCsrfToken(''); setAccountId(''); setAuth(previous => ({ ...previous, user: null })); setError('Your session ended. Sign in again to access your training data.') }; window.addEventListener('gymtrack:expired', expired); const changed = event => { if (event.key === 'gymtrack.auth.change') { setAuth(null); void load() } }; window.addEventListener('storage', changed); return () => { clearTimeout(timer); window.removeEventListener('gymtrack:expired', expired); window.removeEventListener('storage', changed) } }, [load])
  async function login(credential) { setBusy(true); setError(''); try { const value = await request('auth/google', { method: 'POST', body: JSON.stringify({ credential }) }); setCsrfToken(value.csrfToken); setAccountId(value.user.id); setAuth(previous => ({ ...previous, user: value.user })); try { localStorage.setItem('gymtrack.auth.change', crypto.randomUUID()) } catch { /* Storage broadcasts are optional. API account headers still prevent stale-tab writes. */ } } catch (err) { setError(err.message) } finally { setBusy(false) } }
  async function logout() { await request('auth/logout', { method: 'POST', body: '{}' }); setCsrfToken(''); setAccountId(''); setAuth(previous => ({ ...previous, user: null })); try { localStorage.setItem('gymtrack.auth.change', crypto.randomUUID()) } catch { /* Optional cross-tab broadcast. */ } await load() }
  if (window.location.pathname === '/privacy') return <PrivacyPage />
  if (auth?.user) return children(auth.user, logout)
  return <main className="auth-screen"><section className="auth-card"><a className="brand" href="/"><span className="brand-mark"><Icon name="dumbbell" size={23} /></span>gymtrack<span className="brand-period">.</span></a><span className="pill">YOUR PRIVATE TRAINING SPACE</span><h1>Show up.<br /><span>Get stronger.</span></h1><p>Workouts, routines and progress—all in your own account. Sign in with Google to start. No Google password is stored by GymTrack.</p>{error && <div className="banner error" role="alert">{error}</div>}{!auth ? <p role="status">Connecting to your training space…</p> : auth.ready ? <><GoogleButton clientId={auth.clientId} onCredential={login} onError={setError} />{busy && <p role="status">Verifying your sign-in…</p>}</> : <div className="banner warning">Google sign-in setup is pending. Workout data is locked until authentication is configured.</div>}<button className="text-button" disabled={busy} onClick={load}>Retry connection</button><p className="auth-note">Public signup. Private workouts. All weights in kilograms.</p><a className="text-button" href="/privacy">Privacy information</a></section></main>
}
