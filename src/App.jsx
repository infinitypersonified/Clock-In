import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Employee from './Employee.jsx'
import Dashboard from './Dashboard.jsx'

function Auth({ recovery, onRecoveryComplete }) {
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setMessage(null)
    setBusy(true)
    try {
      const { data, error } = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : mode === 'signup'
          ? await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
          : await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      if (mode === 'signup' && !data.session) {
        setMessage({ type: 'status', text: 'Account created. Check your email to confirm it, then sign in.' })
      } else if (mode === 'recover') {
        setMessage({ type: 'status', text: 'If an account exists for that email, a password reset link has been sent.' })
      }
    } catch (error) {
      const text = error.status === 429
        ? 'Too many attempts. Wait a while before trying again.'
        : error.message?.toLowerCase().includes('invalid login credentials')
          ? 'Email or password is incorrect. Check your details or reset your password.'
          : error.message?.toLowerCase().includes('email not confirmed')
            ? 'Confirm your email using the link Supabase sent you, then sign in.'
            : error.message || 'Authentication failed. Please try again.'
      setMessage({ type: 'error', text })
    } finally {
      setBusy(false)
    }
  }

  async function updatePassword(e) {
    e.preventDefault()
    setMessage(null)
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      onRecoveryComplete()
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Password update failed. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  if (recovery) {
    return (
      <main className="auth">
        <h1>Set a new password</h1>
        <form onSubmit={updatePassword}>
          <label>New password<input type="password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></label>
          <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
        </form>
        {message && <p role="alert" className="notice">{message.text}</p>}
      </main>
    )
  }

  return (
    <main className="auth">
      <h1>Clock in</h1>
      <p className="muted">
        {mode === 'signup'
          ? 'Create the first account for the admin. Accounts created after that will be employees.'
          : 'Sign in with your email and password.'}
      </p>
      {mode === 'signup' && (
        <p className="notice notice-info" role="note">
          The first account created after database setup becomes the admin. Use an email you can access.
        </p>
      )}
      <form onSubmit={submit}>
        {mode === 'signup' && (
          <label>Full name<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></label>
        )}
        <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        {mode !== 'recover' && (
          <label>Password<input type="password" minLength={mode === 'signup' ? 6 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send password reset link'}
        </button>
      </form>
      {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`notice ${message.type === 'status' ? 'notice-success' : ''}`}>{message.text}</p>}
      <button type="button" className="link" onClick={() => { setMessage(null); setMode(mode === 'signin' ? 'recover' : 'signin') }}>
        {mode === 'signin' ? 'Forgot your password?' : 'Back to sign in'}
      </button>
      {mode !== 'recover' && (
        <button type="button" className="link" onClick={() => { setMessage(null); setMode(mode === 'signin' ? 'signup' : 'signin') }}>
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      )}
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [recovery, setRecovery] = useState(false)
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      setProfileError('')
      return
    }
    let active = true
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setProfileError(error.message)
          setProfile(null)
          return
        }
        setProfileError('')
        setProfile(data)
      })
    return () => { active = false }
  }, [session])

  if (recovery) return <Auth recovery onRecoveryComplete={() => setRecovery(false)} />
  if (session === undefined) return <p className="muted pad">Loading…</p>
  if (!session) return <Auth recovery={false} onRecoveryComplete={() => setRecovery(false)} />
  if (profileError) {
    return (
      <main className="auth">
        <p role="alert" className="notice">Could not load your account profile: {profileError}</p>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </main>
    )
  }
  if (!profile) return <p className="muted pad">Loading your profile…</p>

  return profile.role === 'employer'
    ? <Dashboard profile={profile} />
    : <Employee profile={profile} />
}
