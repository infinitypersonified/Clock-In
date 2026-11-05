import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getPosition, mapsLink, STATUS_LABEL } from './geo'

function OfficeForm({ office, onSaved }) {
  const [f, setF] = useState({ name: 'Main Office', lat: '', lng: '', radius_m: 100, ...office })
  const [msg, setMsg] = useState('')

  async function useMyLocation() {
    try {
      const p = await getPosition()
      setF({ ...f, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })
    } catch (e) { setMsg(e.message) }
  }

  async function save(e) {
    e.preventDefault()
    const row = { name: f.name, lat: Number(f.lat), lng: Number(f.lng), radius_m: Number(f.radius_m) }
    const { error } = office?.id
      ? await supabase.from('offices').update(row).eq('id', office.id)
      : await supabase.from('offices').insert(row)
    setMsg(error ? error.message : 'Office saved.')
    if (!error) onSaved()
  }

  return (
    <form className="card office" onSubmit={save}>
      <h2>Office location</h2>
      <label>Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
      <div className="grid2">
        <label>Latitude<input value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} required /></label>
        <label>Longitude<input value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} required /></label>
      </div>
      <label>Radius (meters)<input type="number" min="25" value={f.radius_m} onChange={(e) => setF({ ...f, radius_m: e.target.value })} required /></label>
      <div className="row">
        <button type="button" onClick={useMyLocation}>Use my current location</button>
        <button className="primary">Save office</button>
      </div>
      {f.lat && f.lng && <a href={mapsLink(f.lat, f.lng)} target="_blank" rel="noreferrer">Check the pin on Google Maps</a>}
      {msg && <p role="status" className="muted">{msg}</p>}
    </form>
  )
}

export default function Dashboard({ profile }) {
  const [office, setOffice] = useState(null)
  const [rows, setRows] = useState([])
  const [day, setDay] = useState(new Date().toLocaleDateString('en-CA'))
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    setRefreshing(true)
    try {
      const { data: o, error: officeError } = await supabase.from('offices').select('*').limit(1).maybeSingle()
      if (officeError) throw officeError
      const start = new Date(day + 'T00:00:00'), end = new Date(start.getTime() + 86400000)
      const { data, error } = await supabase.from('clock_ins').select('*, profiles(full_name)')
        .gte('at', start.toISOString()).lt('at', end.toISOString()).order('at', { ascending: false })
      if (error) throw error
      setOffice(o)
      setRows(data)
      setLoadError('')
    } catch (e) {
      setLoadError(e.message || 'Could not load dashboard data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }
  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [day])

  const count = (s) => rows.filter((r) => r.status === s).length
  const visibleRows = rows.filter((row) => {
    const matchesName = row.profiles?.full_name?.toLowerCase().includes(search.trim().toLowerCase()) ?? !search.trim()
    return matchesName && (statusFilter === 'all' || row.status === statusFilter)
  })

  return (
    <main className="dash">
      <header className="top">
        <div>
          <h1>Clock-ins</h1>
          <div className="muted">Admin · {profile.full_name}</div>
        </div>
        <div className="row">
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day" />
          <button onClick={load} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
          <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <section aria-label="Daily overview">
        <h2 className="section-title">Daily overview</h2>
        <div className="stats">
          <div className="card stat-card"><span className="muted">Records</span><b>{rows.length}</b></div>
          <div className="card stat-card"><span className="muted">At office</span><b className="ok">{count('at_office')}</b></div>
          <div className="card stat-card"><span className="muted">Away</span><b className="bad">{count('away')}</b></div>
          <div className="card stat-card"><span className="muted">Couldn't verify</span><b className="warn">{count('unverified')}</b></div>
        </div>
      </section>

      <div className="layout">
        <section className="card records-panel">
          <div className="section-heading">
            <div>
              <h2>Attendance records</h2>
              <p className="muted small">{visibleRows.length} of {rows.length} records</p>
            </div>
            <div className="filters">
              <label>Search employee
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name" />
              </label>
              <label>Location status
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="at_office">At office</option>
                  <option value="away">Away</option>
                  <option value="unverified">Couldn't verify</option>
                </select>
              </label>
            </div>
          </div>
          {loadError && <p role="alert" className="notice">{loadError}</p>}
          {loading ? <p role="status" className="muted">Loading attendance…</p>
            : rows.length === 0 ? <p className="empty-state muted">No clock-ins on this day yet.</p>
              : visibleRows.length === 0 ? <p className="empty-state muted">No records match these filters.</p> : (
            <div className="tablewrap">
              <table>
                <caption className="visually-hidden">Attendance records for the selected date</caption>
              <thead><tr><th>Employee</th><th>Action</th><th>Time</th><th>Status</th><th>Accuracy</th><th>Map</th></tr></thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.profiles?.full_name ?? 'Unknown'}</td>
                    <td>{r.type === 'in' ? 'Clock in' : 'Clock out'}</td>
                    <td>{new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span className={'badge ' + r.status}>{STATUS_LABEL[r.status]}</span></td>
                    <td>±{Math.round(r.accuracy_m)} m</td>
                    <td><a href={mapsLink(r.lat, r.lng)} target="_blank" rel="noreferrer">View on map</a></td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}
        </section>
        <OfficeForm key={office?.id ?? 'new'} office={office} onSaved={load} />
      </div>
    </main>
  )
}
