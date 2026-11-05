import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getPosition, distanceMeters, classify, mapsLink, STATUS_LABEL } from './geo'

export default function Employee({ profile }) {
  const [now, setNow] = useState(new Date())
  const [office, setOffice] = useState(null)
  const [last, setLast] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  async function load() {
    const { data: o, error: officeError } = await supabase.from('offices').select('*').limit(1).maybeSingle()
    if (officeError) throw officeError
    setOffice(o)
    const { data: l, error: clockError } = await supabase.from('clock_ins').select('*')
      .eq('user_id', profile.id).order('at', { ascending: false }).limit(1).maybeSingle()
    if (clockError) throw clockError
    setLast(l)
    setLoading(false)
  }
  useEffect(() => {
    load().catch((e) => {
      setError(e.message)
      setLoading(false)
    })
  }, [])

  const clockedIn = last?.type === 'in'

  async function punch() {
    setError('')
    setBusy(true)
    try {
      const pos = await getPosition()
      const { latitude: lat, longitude: lng, accuracy } = pos.coords
      const distance = distanceMeters(lat, lng, office.lat, office.lng)
      const status = classify(distance, accuracy, office.radius_m)
      const row = { user_id: profile.id, type: clockedIn ? 'out' : 'in', lat, lng, accuracy_m: accuracy, distance_m: distance, status }
      const { error: err } = await supabase.from('clock_ins').insert(row)
      if (err) throw err
      setResult(row)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="phone">
      <header className="top">
        <div>
          <div className="muted">{office?.name ?? 'No office set'}</div>
          <h1>Hi, {profile.full_name?.split(' ')[0] ?? 'there'}</h1>
        </div>
        <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>

      <section className="time-card" aria-label="Current time">
        <div className="clock">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        <div className="muted">{now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      </section>

      <section className="card shift-card" aria-live="polite">
        <span className={`shift-indicator ${clockedIn ? 'shift-active' : ''}`}>
          <span className="shift-dot" />
          {loading ? 'Checking your status' : clockedIn ? "You're clocked in" : 'You’re clocked out'}
        </span>
        <span className="muted">
          {last
            ? `Last action: ${last.type === 'in' ? 'Clocked in' : 'Clocked out'} at ${new Date(last.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
            : 'No clock-in recorded today'}
        </span>
      </section>

      {!office && <p className="notice">Your employer hasn't set the office location yet.</p>}

      <button className={'big ' + (clockedIn ? 'out' : 'primary')} disabled={busy || loading || !office} onClick={punch}>
        {busy ? 'Getting your location…' : loading ? 'Loading your status…' : clockedIn ? 'Clock out' : 'Clock in'}
      </button>

      {error && <p role="alert" className="notice">{error}</p>}

      {result && (
        <section className="card">
          <span className={'badge ' + result.status}>{STATUS_LABEL[result.status]}</span>
          <p>
            {result.type === 'in' ? 'Clocked in' : 'Clocked out'} · ±{Math.round(result.accuracy_m)} m accuracy ·{' '}
            {Math.round(result.distance_m)} m from office
          </p>
          <a href={mapsLink(result.lat, result.lng)} target="_blank" rel="noreferrer">View on Google Maps</a>
        </section>
      )}

      <p className="muted small">Your location is captured only when you clock in or out.</p>
    </main>
  )
}
