import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { APP_NAME, APP_TAGLINE } from './config'
import type { PlanEvent, PlannerData, Trip } from './types'

type View = 'calendar' | 'timeline' | 'trips' | 'plan' | 'itinerary' | 'trip-edit' | 'not-found'
type AppRoute = { view: View; tripId?: string }
type TimelineFocusRequest = { date: string; id: number }
type Account = { email: string; token: string }
type PlannerSettings = {
  examplePlansPrompted: boolean
  autoSync: boolean
  lastSync: string | null
  version: number
  syncedData: string | null
}
const defaultSettings: PlannerSettings = {
  examplePlansPrompted: false,
  autoSync: true,
  lastSync: null,
  version: 0,
  syncedData: null,
}
const DATA_KEY = 'ezmygo-planner-data'
const SETTINGS_KEY = 'ezmygo-settings'
const ACCOUNT_KEY = 'ezmygo-account'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const palette = ['#e99961', '#729884', '#7f8fb5', '#c17986', '#b69a54', '#9078aa']
const covers = [
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80',
]
const dateOnly = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const shiftDate = (date: Date, days: number) => { const shifted = new Date(date); shifted.setDate(shifted.getDate() + days); return shifted }
const today = new Date()
const emptyData: PlannerData = { trips: [], events: [] }
const exampleData: PlannerData = {
  trips: [
    { id: 'kyoto', name: 'Slow days in Kyoto', destination: 'Kyoto, Japan', startDate: dateOnly(shiftDate(today, 3)), endDate: dateOnly(shiftDate(today, 9)), color: palette[0], image: covers[0], note: 'A little space to wander.' },
    { id: 'italy', name: 'A summer in Italy', destination: 'Cinque Terre, Italy', startDate: dateOnly(shiftDate(today, 14)), endDate: dateOnly(shiftDate(today, 20)), color: palette[1], image: covers[1], note: 'Coastline, long lunches, no rush.' },
    { id: 'weekend', name: 'Long weekend', destination: 'Paros, Greece', startDate: dateOnly(shiftDate(today, -8)), endDate: dateOnly(shiftDate(today, -5)), color: palette[2], image: covers[2] },
  ],
  events: [
    { id: 'e1', tripId: 'kyoto', title: 'Flight to Osaka', type: 'flight', start: `${dateOnly(shiftDate(today, 3))}T09:30`, end: `${dateOnly(shiftDate(today, 3))}T15:40`, location: 'Kansai International Airport' },
    { id: 'e9', tripId: 'kyoto', title: 'Haruka Express to Kyoto', type: 'flight', start: `${dateOnly(shiftDate(today, 3))}T16:15`, end: `${dateOnly(shiftDate(today, 3))}T17:40`, location: 'Kansai International Airport · Kyoto Station' },
    { id: 'e2', tripId: 'kyoto', title: 'Stay at The Junei Hotel', type: 'stay', start: `${dateOnly(shiftDate(today, 3))}T18:30`, end: `${dateOnly(shiftDate(today, 6))}T11:00`, location: 'Higashiyama, Kyoto' },
    { id: 'e3', tripId: 'kyoto', title: "Walk the Philosopher's Path", type: 'activity', start: `${dateOnly(shiftDate(today, 4))}T08:30`, end: `${dateOnly(shiftDate(today, 4))}T11:00`, location: 'Sakyo Ward' },
    { id: 'e4', tripId: 'kyoto', title: 'Book dinner at Gion Tanto', type: 'task', start: `${dateOnly(shiftDate(today, 4))}T16:00` },
    { id: 'e5', tripId: 'kyoto', title: 'Tea ceremony', type: 'activity', start: `${dateOnly(shiftDate(today, 5))}T14:00`, end: `${dateOnly(shiftDate(today, 5))}T15:30`, location: 'Camellia Garden' },
    { id: 'e6', tripId: 'italy', title: 'Train to Monterosso', type: 'flight', start: `${dateOnly(shiftDate(today, 14))}T10:20`, end: `${dateOnly(shiftDate(today, 14))}T12:15`, location: 'Milano Centrale' },
    { id: 'e7', tripId: 'italy', title: 'Casa della Marina', type: 'stay', start: `${dateOnly(shiftDate(today, 14))}T15:00`, end: `${dateOnly(shiftDate(today, 18))}T10:00`, location: 'Riomaggiore' },
    { id: 'e8', tripId: 'weekend', title: 'A morning by the water', type: 'activity', start: `${dateOnly(shiftDate(today, -7))}T09:00`, end: `${dateOnly(shiftDate(today, -7))}T12:00` },
  ],
}

function readStorage<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
}
function readSettings(): PlannerSettings {
  const stored = readStorage<Partial<PlannerSettings>>(SETTINGS_KEY, {})
  return {
    examplePlansPrompted: stored.examplePlansPrompted ?? defaultSettings.examplePlansPrompted,
    autoSync: stored.autoSync ?? defaultSettings.autoSync,
    lastSync: stored.lastSync ?? defaultSettings.lastSync,
    version: stored.version ?? defaultSettings.version,
    syncedData: stored.syncedData ?? defaultSettings.syncedData,
  }
}
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
const prettyDate = (date: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) =>
  new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', options)
const monthTitle = (date: Date) => date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
const eventDay = (event: PlanEvent) => event.start.slice(0, 10)
const shiftDateTime = (dateTime: string, days: number) => {
  const date = new Date(`${dateTime.slice(0, 10)}T12:00:00`)
  date.setDate(date.getDate() + days)
  return `${dateOnly(date)}${dateTime.slice(10)}`
}
const dayDistance = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000)
const formatTime = (date: string) => new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '')
const eventTimeRange = (event: PlanEvent) => {
  if (!event.end) return formatTime(event.start)
  if (event.end.slice(0, 10) === eventDay(event)) return `${formatTime(event.start)} - ${formatTime(event.end)}`
  return `${formatTime(event.start)} - ${prettyDate(event.end, { month: 'short', day: 'numeric' })} ${formatTime(event.end)}`
}
const eventTypeLabel: Record<PlanEvent['type'], string> = { flight: 'Travel', stay: 'Stay', activity: 'Activity', task: 'To-do', place: 'Place' }

function resolveRoute(pathname: string): AppRoute {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/' || path === '/calendar') return { view: 'calendar' }
  if (path === '/timeline') return { view: 'timeline' }
  if (path === '/trips') return { view: 'trips' }
  const tripMatch = path.match(/^\/trips\/([^/]+)(?:\/(edit|itinerary))?$/)
  if (tripMatch) {
    let tripId: string
    try { tripId = decodeURIComponent(tripMatch[1]) } catch { return { view: 'not-found' } }
    return { view: tripMatch[2] === 'edit' ? 'trip-edit' : tripMatch[2] === 'itinerary' ? 'itinerary' : 'plan', tripId }
  }
  return { view: 'not-found' }
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
    sync: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9a7 7 0 0 1 11.6-2L20 12M4 12l2.9 5a7 7 0 0 0 11.6-2" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    plane: <path d="m3 11 18-7-7 18-3-8-8-3Zm8 3 6-6" />,
    bed: <><path d="M3 18v-7m0 4h18v3M5 15v-3h5a3 3 0 0 1 3 3M21 15v-4a2 2 0 0 0-2-2h-4" /><path d="M3 20v-2m18 2v-2" /></>,
    pinSmall: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    logout: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
  }
  return <svg {...common}>{paths[name] ?? paths.grid}</svg>
}

function App() {
  const [data, setData] = useState<PlannerData>(() => readStorage(DATA_KEY, emptyData))
  const location = useLocation()
  const navigate = useNavigate()
  const route = useMemo(() => resolveRoute(location.pathname), [location.pathname])
  const { view, tripId: activeTripId } = route
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [filter, setFilter] = useState('all')
  const [timelineFocus, setTimelineFocus] = useState<TimelineFocusRequest | null>(null)
  const timelineFocusId = useRef(0)
  const [eventModal, setEventModal] = useState<PlanEvent | 'new' | null>(null)
  const [tripModal, setTripModal] = useState<Trip | 'new' | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [examplePromptOpen, setExamplePromptOpen] = useState(false)
  const [remoteConflictOpen, setRemoteConflictOpen] = useState(false)
  const [account, setAccount] = useState<Account | null>(() => readStorage(ACCOUNT_KEY, null))
  const [settings, setSettings] = useState<PlannerSettings>(readSettings)
  const { autoSync, lastSync, version } = settings
  const updateSettings = useCallback((updates: Partial<PlannerSettings>) => {
    setSettings((current) => ({ ...current, ...updates }))
  }, [])
  const setAutoSync = useCallback((enabled: boolean) => {
    updateSettings({ autoSync: enabled })
  }, [updateSettings])
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState('')
  const [pendingRemote, setPendingRemote] = useState<{ data: PlannerData; version: number; created_at?: number } | null>(null)
  const lastSyncedData = useRef<string | null>(settings.syncedData)
  const modalHistoryPath = useRef<string | null>(null)
  const modalOpen = Boolean(eventModal || tripModal || accountOpen || logoutConfirmOpen || examplePromptOpen || remoteConflictOpen)

  useEffect(() => { localStorage.setItem(DATA_KEY, JSON.stringify(data)) }, [data])
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) }, [settings])
  useEffect(() => {
    if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
    else localStorage.removeItem(ACCOUNT_KEY)
  }, [account])
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 3500); return () => window.clearTimeout(timer) }, [notice])
  useEffect(() => { if (activeTripId) setFilter(activeTripId) }, [activeTripId])
  useEffect(() => {
    if (view !== 'trips' || settings.examplePlansPrompted) return
    setSettings((current) => ({ ...current, examplePlansPrompted: true }))
    if (data.trips.length === 0) setExamplePromptOpen(true)
  }, [data.trips.length, settings.examplePlansPrompted, view])
  useEffect(() => {
    if (modalOpen) {
      if (modalHistoryPath.current === null) {
        modalHistoryPath.current = location.pathname
        navigate(`${location.pathname}${location.search}${location.hash}`, { state: { ezmygoModal: true } })
      }
      return
    }
    const modalPath = modalHistoryPath.current
    if (modalPath !== null) {
      modalHistoryPath.current = null
      if (location.pathname === modalPath && window.history.state?.usr?.ezmygoModal) navigate(-1)
    }
  }, [location.hash, location.pathname, location.search, modalOpen, navigate])
  useEffect(() => {
    const closeModalOnBack = () => {
      if (modalHistoryPath.current === null) return
      modalHistoryPath.current = null
      setEventModal(null)
      setTripModal(null)
      setAccountOpen(false)
      setLogoutConfirmOpen(false)
      setExamplePromptOpen(false)
      setRemoteConflictOpen(false)
    }
    window.addEventListener('popstate', closeModalOnBack)
    return () => window.removeEventListener('popstate', closeModalOnBack)
  }, [])

  const syncData = useCallback(async (quiet = false) => {
    if (!account) { if (!quiet) setAccountOpen(true); return }
    if (pendingRemote) {
      if (!quiet) {
        setRemoteConflictOpen(true)
        setNotice('Choose which version to keep before syncing.')
      }
      return
    }
    if (!navigator.onLine) { if (!quiet) setNotice("You're offline. Your plans are saved on this device."); return }
    setSyncing(true)
    try {
      const response = await fetch(`${API_URL}/api/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_version: version, data }),
      })
      if (response.status === 401) {
        setAccount(null)
        throw new Error('Your session expired. Sign in again to sync.')
      }
      if (response.status === 409) throw new Error("A newer version exists on the server. Review your account's latest snapshot before syncing.")
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || 'Could not sync your plans.')
      const result = await response.json() as { version: number; created_at: string }
      const syncedData = JSON.stringify(data)
      lastSyncedData.current = syncedData
      const syncedAt = result.created_at || new Date().toISOString()
      updateSettings({ version: result.version, syncedData, lastSync: syncedAt })
      if (!quiet) setNotice('Everything is up to date.')
    } catch (error) {
      if (!quiet) setNotice(error instanceof Error ? error.message : 'Sync failed. Please try again.')
    } finally { setSyncing(false) }
  }, [account, data, pendingRemote, setAccount, updateSettings, version])

  useEffect(() => {
    if (!autoSync || !account || pendingRemote || lastSyncedData.current === JSON.stringify(data)) return
    const timer = window.setTimeout(() => {
      if (lastSyncedData.current !== JSON.stringify(data)) void syncData(true)
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [data, autoSync, account, pendingRemote, syncData])

  const visibleEvents = useMemo(() => data.events.filter((event) => filter === 'all' || event.tripId === filter), [data.events, filter])
  const filteredTrips = useMemo(() => filter === 'all' ? data.trips : data.trips.filter((trip) => trip.id === filter), [data.trips, filter])
  const activeTrips = data.trips.filter((trip) => trip.endDate >= dateOnly(today)).length
  const activeTrip = data.trips.find((trip) => trip.id === activeTripId)
  const selectedTrip = data.trips.find((trip) => trip.id === (activeTripId ?? filter))

  const selectTripFilter = (tripId: string | 'all') => {
    if (filter === tripId) return
    setFilter(tripId)
    if (tripId === 'all') {
      setTimelineFocus(null)
      return
    }

    const trip = data.trips.find((item) => item.id === tripId)
    if (!trip) return
    const currentDate = dateOnly(new Date())
    const tripEvents = data.events
      .filter((event) => event.tripId === tripId)
      .sort((a, b) => a.start.localeCompare(b.start))
    const focusDate = currentDate >= trip.startDate && currentDate <= trip.endDate
      ? currentDate
      : currentDate < trip.startDate
        ? (tripEvents.length ? eventDay(tripEvents[0]) : trip.startDate)
        : (tripEvents.at(-1)?.end?.slice(0, 10) ?? tripEvents.at(-1)?.start.slice(0, 10) ?? trip.endDate)

    if (view === 'calendar') {
      setMonth(new Date(`${focusDate}T12:00:00`))
      setTimelineFocus(null)
    } else {
      setTimelineFocus({ date: focusDate, id: ++timelineFocusId.current })
      if (view !== 'timeline') navigate('/timeline')
    }
  }
  const clearTimelineFocus = (id: number) => {
    setTimelineFocus((current) => current?.id === id ? null : current)
  }

  const saveEvent = (event: PlanEvent) => setData((current) => ({ ...current, events: [...current.events.filter((item) => item.id !== event.id), event].sort((a, b) => a.start.localeCompare(b.start)) }))
  const deleteEvent = (id: string) => { setData((current) => ({ ...current, events: current.events.filter((event) => event.id !== id) })); setEventModal(null) }
  const saveTrip = (trip: Trip) => setData((current) => ({ ...current, trips: [...current.trips.filter((item) => item.id !== trip.id), trip].sort((a, b) => a.startDate.localeCompare(b.startDate)) }))
  const deleteTrip = (id: string) => {
    setData((current) => ({ trips: current.trips.filter((trip) => trip.id !== id), events: current.events.filter((event) => event.tripId !== id) }))
    if (filter === id) setFilter('all')
    if (activeTripId === id) navigate('/trips')
    setTripModal(null)
  }
  const openTripPlan = (tripId: string, destination: 'plan' | 'itinerary' = 'plan') => {
    setFilter(tripId)
    navigate(`/trips/${encodeURIComponent(tripId)}${destination === 'itinerary' ? '/itinerary' : ''}`, { replace: Boolean(eventModal) })
    setEventModal(null)
  }
  const doAuth = async (email: string, password: string, mode: 'login' | 'register') => {
    const response = await fetch(`${API_URL}/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    const body = await response.json()
    if (!response.ok) {
      const detail = body.detail
      throw new Error(typeof detail === 'string' ? detail : detail?.message || 'Could not connect your account.')
    }
    const nextAccount = { email: body.email as string, token: body.access_token as string }
    setAccount(nextAccount)
    const remoteVersion = body.version ?? 0
    const localHasUnsyncedChanges = lastSyncedData.current !== null && lastSyncedData.current !== JSON.stringify(data)
    if (body.snapshot && remoteVersion > version && localHasUnsyncedChanges) {
      setPendingRemote({ data: body.snapshot as PlannerData, version: remoteVersion, created_at: body.created_at })
      setRemoteConflictOpen(true)
      setAccountOpen(false)
      setNotice('A newer backup was found. Choose which version to keep.')
    } else if (body.snapshot && (!lastSync || remoteVersion > version)) {
      const snapshot = body.snapshot as PlannerData
      setData(snapshot)
      const syncedData = JSON.stringify(snapshot)
      lastSyncedData.current = syncedData
      const settingsUpdate: Partial<PlannerSettings> = { version: remoteVersion, syncedData }
      if (body.created_at) {
        const syncedAt = new Date(body.created_at * 1000).toISOString()
        settingsUpdate.lastSync = syncedAt
      }
      updateSettings(settingsUpdate)
      setAccountOpen(false); setNotice('Your latest synced plans are ready on this device.')
    } else {
      updateSettings({ version: remoteVersion })
      setAccountOpen(false); setNotice(`Connected as ${nextAccount.email}.`)
    }
  }
  const logout = async () => {
    let offline = false
    if (account) {
      try {
        const response = await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${account.token}` } })
        if (!response.ok) offline = true
      } catch { offline = true }
    }
    setAccount(null)
    setNotice(offline ? 'Signed out on this device. The server session will expire automatically.' : 'Signed out.')
  }
  const requestLogout = () => {
    setAccountOpen(false)
    setLogoutConfirmOpen(true)
  }
  const confirmLogout = () => {
    setLogoutConfirmOpen(false)
    void logout()
  }
  const addExamplePlans = () => {
    const tripIds = new Map(exampleData.trips.map((trip) => [trip.id, newId()]))
    setData((current) => ({
      trips: [...current.trips, ...exampleData.trips.map((trip) => ({ ...trip, id: tripIds.get(trip.id) ?? newId() }))],
      events: [...current.events, ...exampleData.events.map((event) => ({
        ...event,
        id: newId(),
        tripId: tripIds.get(event.tripId) ?? event.tripId,
      }))],
    }))
    setExamplePromptOpen(false)
    setNotice('Example trips added. Make them your own!')
  }
  const keepLocalSnapshot = () => {
    if (!pendingRemote) return
    updateSettings({ version: pendingRemote.version })
    setPendingRemote(null)
    setRemoteConflictOpen(false)
    setNotice('Your local plans are being synced as a new version.')
  }
  const restoreRemoteSnapshot = () => {
    if (!pendingRemote) return
    setData(pendingRemote.data)
    const syncedData = JSON.stringify(pendingRemote.data)
    lastSyncedData.current = syncedData
    const settingsUpdate: Partial<PlannerSettings> = {
      version: pendingRemote.version,
      syncedData,
    }
    if (pendingRemote.created_at) {
      const syncedAt = new Date(pendingRemote.created_at * 1000).toISOString()
      settingsUpdate.lastSync = syncedAt
    }
    updateSettings(settingsUpdate)
    setPendingRemote(null)
    setRemoteConflictOpen(false)
    setNotice('Restored the latest synced plans.')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/calendar"><span className="brand-mark">{APP_NAME[0].toLowerCase()}</span><span className="brand-wordmark"><span>{APP_NAME}<span className="brand-period">.</span></span><small>{APP_TAGLINE}</small></span></Link>
        <div className="side-label">Workspace</div>
        <nav className="main-nav" aria-label="Main navigation">
          <Link className={view === 'calendar' ? 'nav-item active' : 'nav-item'} to="/calendar"><Icon name="calendar" />Calendar</Link>
          <Link className={view === 'timeline' ? 'nav-item active' : 'nav-item'} to="/timeline"><Icon name="clock" />Timeline</Link>
          <Link className={view === 'trips' || view === 'plan' || view === 'itinerary' || view === 'trip-edit' ? 'nav-item active' : 'nav-item'} to="/trips"><Icon name="grid" />My trips<span className="nav-count">{data.trips.length}</span></Link>
        </nav>
        {view !== 'trips' && <>
          <div className="trip-list-head"><span className="side-label">Your trips</span><button aria-label="Create trip" className="tiny-add" onClick={() => setTripModal('new')}><Icon name="plus" size={16} /></button></div>
          <div className="side-trips">
            <button className={`side-trip ${filter === 'all' ? 'selected' : ''}`} onClick={() => selectTripFilter('all')}><span className="trip-dot all-dot" /><span>All trips</span><span className="side-trip-count">{data.trips.length}</span></button>
            {data.trips.map((trip) => <button key={trip.id} className={`side-trip ${filter === trip.id ? 'selected' : ''}`} onClick={() => selectTripFilter(trip.id)}><span className="trip-dot" style={{ backgroundColor: trip.color }} /><span className="side-trip-name">{trip.name}</span></button>)}
          </div>
        </>}
        <div className="sidebar-bottom">
          <div className="sync-card"><span className="sync-orb"><Icon name="sync" size={15} /></span><div><strong>{account ? 'Sync is ready' : 'Your plans, anywhere'}</strong><small>{lastSync ? `Synced ${new Date(lastSync).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Saved on this device'}</small></div></div>
          {account
            ? <div className="profile-button"><span className="avatar">{account.email.slice(0, 1).toUpperCase()}</span><span className="profile-text"><strong>{account.email.split('@')[0]}</strong><small>Connected account</small></span><button className="sidebar-logout" onClick={requestLogout} aria-label="Log out" title="Log out"><Icon name="logout" size={18} /></button></div>
            : <button className="profile-button" onClick={() => setAccountOpen(true)}><span className="avatar">G</span><span className="profile-text"><strong>Guest</strong><small>Guest mode</small></span><Icon name="more" size={18} /></button>}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><Icon name="chevron" size={14} /><span className="mobile-app-name">{APP_NAME}</span><span className="mobile-title-separator">/</span><strong>{view === 'trips' ? 'My trips' : view === 'timeline' ? 'Timeline' : view === 'plan' ? 'Trip plan' : view === 'itinerary' ? 'Edit itinerary' : view === 'trip-edit' ? 'Edit trip' : view === 'not-found' ? 'Not found' : 'Calendar'}</strong>{selectedTrip && view !== 'trips' && <><Icon name="chevron" size={14} /><span>{selectedTrip.name}</span></>}</div>
          <div className="top-actions"><button className="icon-button" aria-label="Search plans" onClick={() => setNotice('Tip: select a trip from the left to filter your plans.')}><Icon name="search" /></button><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotice("You're all caught up.")}><Icon name="bell" /><span /></button><div className="top-divider" /><button className={`sync-button ${syncing ? 'is-syncing' : ''}`} onClick={() => void syncData()} disabled={syncing}><Icon name="sync" size={16} />{syncing ? 'Syncing' : 'Sync now'}</button><button className="avatar top-avatar" onClick={() => setAccountOpen(true)} aria-label="Account settings">{account ? account.email.slice(0, 1).toUpperCase() : 'G'}</button></div>
        </header>

        <div className="page-content">
          {view === 'calendar' && <CalendarView month={month} setMonth={setMonth} events={visibleEvents} trips={data.trips} onNew={() => setEventModal('new')} onEdit={setEventModal} />}
          {view === 'timeline' && <TimelineView events={visibleEvents} trips={data.trips} focusRequest={timelineFocus} onFocusHandled={clearTimelineFocus} onNew={() => setEventModal('new')} onEdit={setEventModal} />}
          {view === 'trips' && <TripsView trips={data.trips} events={data.events} onNew={() => setTripModal('new')} onEdit={(trip) => navigate(`/trips/${encodeURIComponent(trip.id)}/edit`)} onNewEvent={() => setEventModal('new')} onOpenPlan={(tripId) => openTripPlan(tripId)} />}
          {view === 'plan' && activeTrip && <TripPlanPage trip={activeTrip} events={data.events.filter((event) => event.tripId === activeTrip.id)} onBack={() => navigate('/trips')} onEditTrip={() => navigate(`/trips/${encodeURIComponent(activeTrip.id)}/edit`)} onEditItinerary={() => navigate(`/trips/${encodeURIComponent(activeTrip.id)}/itinerary`)} onAddEvent={() => setEventModal('new')} onEditEvent={setEventModal} />}
          {view === 'itinerary' && activeTrip && <ItineraryEditorPage trip={activeTrip} events={data.events.filter((event) => event.tripId === activeTrip.id)} onBack={() => navigate(`/trips/${encodeURIComponent(activeTrip.id)}`)} onAddEvent={() => setEventModal('new')} onEditEvent={setEventModal} onDeleteEvent={deleteEvent} onMoveEvent={saveEvent} />}
          {view === 'trip-edit' && activeTrip && <TripEditorPage trip={activeTrip} onCancel={() => navigate(`/trips/${encodeURIComponent(activeTrip.id)}`)} onSave={(trip) => { saveTrip(trip); setNotice('Trip saved.'); navigate(`/trips/${encodeURIComponent(trip.id)}`) }} onDelete={deleteTrip} />}
          {(view === 'not-found' || (activeTripId && !activeTrip)) && <section className="not-found-page"><div className="eyebrow"><span className="eyebrow-line" />NOT HERE</div><h1>We couldn't find that page<span>.</span></h1><p>This trip may have been removed, or the address may be out of date.</p><Link className="primary-button" to="/trips">Back to all trips</Link></section>}
          {(view === 'calendar' || view === 'timeline') && <footer className="page-footer"><span><span className="footer-dot" />{activeTrips} upcoming {activeTrips === 1 ? 'trip' : 'trips'}</span><span>{visibleEvents.length} plans across {filteredTrips.length} {filteredTrips.length === 1 ? 'trip' : 'trips'}</span><button className="auto-sync-toggle" onClick={() => setAutoSync(!autoSync)}><span className={`toggle ${autoSync ? 'on' : ''}`}><i /></span>Auto-sync {autoSync ? 'on' : 'off'}</button></footer>}
        </div>
      </main>
      {eventModal && <EventDialog initial={eventModal === 'new' ? null : eventModal} trips={data.trips} defaultTripId={activeTripId ?? undefined} onClose={() => setEventModal(null)} onSave={(event) => { saveEvent(event); setEventModal(null); setNotice('Plan saved on this device.') }} onDelete={deleteEvent} onEditPlan={(tripId) => openTripPlan(tripId)} />}
      {tripModal && <TripDialog initial={tripModal === 'new' ? null : tripModal} onClose={() => setTripModal(null)} onSave={(trip) => { saveTrip(trip); setTripModal(null); setNotice('Trip saved.') }} onDelete={deleteTrip} />}
      {accountOpen && <AccountDialog account={account} onClose={() => setAccountOpen(false)} onAuth={doAuth} onRequestLogout={requestLogout} onSync={() => void syncData()} lastSync={lastSync} autoSync={autoSync} setAutoSync={setAutoSync} />}
      {examplePromptOpen && <DialogFrame title="A few plans to get you going?" subtitle="Would you like to explore EzMyGo with a few example trips? You can edit or delete them anytime." onClose={() => setExamplePromptOpen(false)} className="account-dialog"><div className="dialog-actions"><button className="secondary-button" onClick={() => setExamplePromptOpen(false)}>Maybe later</button><span /><button className="primary-button" onClick={addExamplePlans}>Add example trips</button></div></DialogFrame>}
      {logoutConfirmOpen && <DialogFrame title="Sign out?" subtitle="Your plans will stay saved on this device. You can sign in again to sync." onClose={() => setLogoutConfirmOpen(false)} className="logout-confirm-dialog"><div className="dialog-actions"><span /><button className="secondary-button" onClick={() => setLogoutConfirmOpen(false)}>Cancel</button><button className="primary-button confirm-logout-button" onClick={confirmLogout}>Log out</button></div></DialogFrame>}
      {pendingRemote && remoteConflictOpen && <DialogFrame title="A newer backup is waiting." subtitle={`This device has local changes, and your account has reached version ${pendingRemote.version}. Choose which snapshot to keep.`} onClose={() => { setRemoteConflictOpen(false); setNotice('Sync paused. Choose Sync now when you are ready to review the backup.') }} className="account-dialog"><div className="dialog-form"><button className="primary-button auth-submit" onClick={restoreRemoteSnapshot}>Restore the latest backup</button><button className="secondary-button auth-submit" onClick={keepLocalSnapshot}>Keep this device's plans</button><button className="secondary-button auth-submit" onClick={() => { setRemoteConflictOpen(false); setNotice('Sync paused. Choose Sync now when you are ready to review the backup.') }}>Decide later</button><p className="offline-note">Your choice creates a new version. Previous server snapshots remain in history.</p></div></DialogFrame>}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}

function CalendarView({ month, setMonth, events, trips, onNew, onEdit }: { month: Date; setMonth: (date: Date) => void; events: PlanEvent[]; trips: Trip[]; onNew: () => void; onEdit: (event: PlanEvent) => void }) {
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1))
  const todayKey = dateOnly(today)
  return <section className="calendar-page">
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />YOUR SPACE TO WANDER</div><h1>A life well planned<span>.</span></h1><p>All the places you're going, and everything in between.</p></div><button className="primary-button" onClick={onNew}><Icon name="plus" size={17} />Add to itinerary</button></div>
    <div className="month-toolbar"><div className="month-title"><h2>{monthTitle(month)}</h2><span className="month-subtitle">A little look at what's ahead</span></div><div className="month-controls"><button className="today-button" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button><button className="arrow-button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Icon name="left" size={17} /></button><button className="arrow-button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Icon name="right" size={17} /></button><div className="view-switch"><span className="view-current"><Icon name="calendar" size={15} />Month</span><span className="view-switch-divider" /><Link className="view-option" to="/timeline"><Icon name="clock" size={15} />Timeline</Link></div></div></div>
    <div className="calendar-card"><div className="weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day}>{day}</div>)}</div><div className="calendar-grid">{days.map((day) => {
      const date = dateOnly(day)
      const dayEvents = events.filter((event) => date >= eventDay(event) && date <= (event.end?.slice(0, 10) ?? eventDay(event))).sort((a, b) => a.start.localeCompare(b.start))
      return <div key={date} className={`calendar-day ${day.getMonth() !== month.getMonth() ? 'outside-month' : ''} ${date === todayKey ? 'is-today' : ''}`}><span className={`day-number ${date === todayKey ? 'today-number' : ''}`}>{day.getDate()}</span><div className="day-events">{dayEvents.slice(0, 3).map((event) => {
        const trip = trips.find((item) => item.id === event.tripId)
        const multiStart = date === eventDay(event) && date < (event.end?.slice(0, 10) ?? date)
        const multiEnd = date === event.end?.slice(0, 10) && date > eventDay(event)
        return <button key={event.id} className={`calendar-event ${multiStart ? 'span-start' : ''} ${multiEnd ? 'span-end' : ''}`} style={{ '--event-color': trip?.color ?? '#8793a2' } as React.CSSProperties} onClick={() => onEdit(event)} title={event.title}><span className="event-dot" />{event.title}</button>
      })}{dayEvents.length > 3 && <button className="more-events">+{dayEvents.length - 3} more</button>}</div></div>
    })}</div></div>
    <div className="calendar-legend"><span>TRIPS IN VIEW</span>{trips.slice(0, 4).map((trip) => <span className="legend-trip" key={trip.id}><i style={{ background: trip.color }} />{trip.name}</span>)}</div>
  </section>
}

function TimelineView({ events, trips, focusRequest, onFocusHandled, onNew, onEdit }: { events: PlanEvent[]; trips: Trip[]; focusRequest: TimelineFocusRequest | null; onFocusHandled: (id: number) => void; onNew: () => void; onEdit: (event: PlanEvent) => void }) {
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const todayStart = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate())
  const [rangeStart, setRangeStart] = useState(() => shiftDate(focusRequest ? new Date(`${focusRequest.date}T12:00:00`) : todayStart, -30))
  const [dayCount, setDayCount] = useState(61)
  const listRef = useRef<HTMLDivElement>(null)
  const todayRef = useRef<HTMLDivElement>(null)
  const dayRefs = useRef(new Map<string, HTMLDivElement>())
  const handledFocusId = useRef<number | null>(null)
  const previousHeight = useRef(0)
  const prepending = useRef(false)
  const expanding = useRef(false)
  const range = Array.from({ length: dayCount }, (_, index) => dateOnly(shiftDate(rangeStart, index)))
  const orderedEvents = [...events].sort((a, b) => a.start.localeCompare(b.start))
  const todayKey = dateOnly(todayStart)
  const minuteOfDay = currentTime.getHours() * 60 + currentTime.getMinutes()

  useEffect(() => {
    const refreshTime = () => setCurrentTime(new Date())
    const timer = window.setInterval(refreshTime, 60_000)
    window.addEventListener('focus', refreshTime)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshTime)
    }
  }, [])

  useLayoutEffect(() => {
    if (!focusRequest) todayRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  useLayoutEffect(() => {
    const list = listRef.current
    if (prepending.current && list) list.scrollTop += list.scrollHeight - previousHeight.current
    prepending.current = false
    expanding.current = false
  }, [rangeStart, dayCount])

  useLayoutEffect(() => {
    if (!focusRequest || handledFocusId.current === focusRequest.id) return
    const offset = dayDistance(dateOnly(rangeStart), focusRequest.date)
    if (offset < 0 || offset >= dayCount) {
      setRangeStart(shiftDate(new Date(`${focusRequest.date}T12:00:00`), -30))
      setDayCount(61)
      return
    }
    const target = dayRefs.current.get(focusRequest.date)
    if (!target) return
    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    handledFocusId.current = focusRequest.id
    onFocusHandled(focusRequest.id)
  }, [dayCount, focusRequest, onFocusHandled, rangeStart])

  const handleScroll = () => {
    const list = listRef.current
    if (!list || expanding.current) return
    const topDistance = list.scrollTop
    const bottomDistance = list.scrollHeight - list.clientHeight - list.scrollTop
    if (topDistance < 220) {
      expanding.current = true
      prepending.current = true
      previousHeight.current = list.scrollHeight
      setRangeStart((current) => shiftDate(current, -30))
      setDayCount((current) => current + 30)
    } else if (bottomDistance < 220) {
      expanding.current = true
      setDayCount((current) => current + 30)
    }
  }

  const goToToday = () => todayRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })

  return <section className="timeline-page">
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />THE DAYS AHEAD</div><h1>Your journey, <span>unfolding.</span></h1><p>A little room for everything that's been and everything ahead.</p></div><button className="primary-button" onClick={onNew}><Icon name="plus" size={17} />Add to itinerary</button></div>
    <div className="timeline-toolbar"><div className="timeline-range"><span className="range-dot" />{prettyDate(range[0], { month: 'long', day: 'numeric' })} - {prettyDate(range[range.length - 1], { month: 'long', day: 'numeric', year: 'numeric' })}</div><div className="timeline-toolbar-actions"><span className="timeline-caption">Your plans, at a glance</span><button className="today-button go-today-button" onClick={goToToday}><Icon name="calendar" size={14} />Go to Today</button></div></div>
    <div className="timeline-list" ref={listRef} onScroll={handleScroll}>{range.map((date) => {
      const dayEvents = orderedEvents.filter((event) => date >= eventDay(event) && date <= (event.end?.slice(0, 10) ?? eventDay(event)))
      const isToday = date === todayKey
      const isPast = date < todayKey
      const axisStart = 360
      const axisDuration = 960
      const currentTimePosition = Math.max(0, Math.min(100, ((minuteOfDay - axisStart) / axisDuration) * 100))
      const showSchedule = dayEvents.length > 0 || isToday
      const laneEnds: number[] = []
      const placements = dayEvents.map((event) => {
        const starts = eventDay(event) === date
        const ends = event.end?.slice(0, 10) === date
        const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5))
        const startMinute = Math.max(axisStart, Math.min(axisStart + axisDuration - 30, starts ? minutes(event.start.slice(11, 16)) : axisStart))
        const endMinute = Math.max(startMinute + 30, Math.min(axisStart + axisDuration, event.end ? ends ? minutes(event.end.slice(11, 16)) : axisStart + axisDuration : startMinute + 60))
        const lane = laneEnds.findIndex((laneEnd) => laneEnd <= startMinute)
        const laneIndex = lane < 0 ? laneEnds.length : lane
        laneEnds[laneIndex] = Math.max(endMinute, startMinute + 340)
        return { event, starts, ends, startMinute, endMinute, lane: laneIndex }
      })
      const laneCount = Math.max(laneEnds.length, 1)
      return <div key={date} ref={(element) => { if (element) dayRefs.current.set(date, element); else dayRefs.current.delete(date); if (isToday) todayRef.current = element }} className={`timeline-day ${dayEvents.length ? 'has-events' : ''} ${showSchedule ? 'has-schedule' : ''} ${isToday ? 'today-row' : ''}`}><div className="timeline-date"><span className={`timeline-date-number ${isToday ? 'today-number' : ''}`}>{prettyDate(date, { day: 'numeric' })}</span><span className="timeline-date-label">{isToday ? 'Today' : prettyDate(date, { weekday: 'short' })}</span></div><div className="timeline-rail"><i className={isPast ? 'rail-node past' : isToday ? 'rail-node today' : 'rail-node'} /></div><div className="timeline-content">{showSchedule ? <div className="timeline-schedule">{placements.map(({ event, starts, ends, startMinute, endMinute, lane }) => {
        const trip = trips.find((item) => item.id === event.tripId)
        const style = {
          '--event-color': trip?.color ?? '#8793a2',
          '--event-start': `${((startMinute - axisStart) / axisDuration) * 100}%`,
          '--event-duration': `${((endMinute - startMinute) / axisDuration) * 100}%`,
          '--event-lane': lane,
          '--event-lanes': laneCount,
        } as React.CSSProperties
        return <button key={`${event.id}-${date}`} className={`timeline-event ${starts && ends ? 'one-day' : starts ? 'event-begins' : ends ? 'event-finishes' : 'event-continues'}`} style={style} onClick={() => onEdit(event)} title={`${event.title}${event.location ? ` · ${event.location}` : ''}`} aria-label={`${event.title}, ${trip?.name ?? 'Unassigned'}, ${starts ? formatTime(event.start) : 'continuing'}`}><span className="timeline-event-top"><span className="timeline-event-type">{eventTypeLabel[event.type]}</span><span className="timeline-event-time">{starts ? formatTime(event.start) : 'Continues'}</span></span><strong>{event.title}</strong>{event.location && <span className="timeline-event-location"><Icon name="pinSmall" size={12} />{event.location}</span>}</button>
      })}{isToday && <div className="current-time-indicator" style={{ top: `${currentTimePosition}%` }} aria-label={`Current time ${currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}><span>Now</span></div>}</div> : <div className="empty-day" />}</div></div>
    })}</div>
  </section>
}

function TripPlanPage({ trip, events, onBack, onEditTrip, onEditItinerary, onAddEvent, onEditEvent }: {
  trip: Trip
  events: PlanEvent[]
  onBack: () => void
  onEditTrip: () => void
  onEditItinerary: () => void
  onAddEvent: () => void
  onEditEvent: (event: PlanEvent) => void
}) {
  const sortedEvents = [...events].sort((a, b) => a.start.localeCompare(b.start))
  return <section className="trip-plan-page">
    <button className="back-link" onClick={onBack}><Icon name="left" size={15} />All trips</button>
    <div className="plan-title-row">
      <div><div className="eyebrow"><span className="eyebrow-line" />YOUR TRIP PLAN</div><h1>{trip.name}</h1><p><Icon name="pinSmall" size={14} />{trip.destination}</p></div>
      <div className="plan-header-actions"><button className="secondary-button" onClick={onEditTrip}>Edit trip details</button><button className="primary-button" onClick={onEditItinerary}><Icon name="calendar" size={15} />Edit itinerary</button></div>
    </div>
    <div className="plan-cover" style={{ backgroundImage: `linear-gradient(90deg, rgba(28,42,37,.62), rgba(28,42,37,.06)), url("${trip.image}")` }}>
      <span className="plan-cover-kicker">A LITTLE TIME AWAY</span>
      <strong>{prettyDate(trip.startDate, { month: 'long', day: 'numeric' })} - {prettyDate(trip.endDate, { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
      {trip.note && <span>{trip.note}</span>}
    </div>
    <section className="plan-itinerary-section">
      <div className="plan-section-heading"><div><span className="eyebrow"><span className="eyebrow-line" />THE DETAILS</span><h2>Your itinerary</h2></div><div className="plan-header-actions"><button className="secondary-button" onClick={onAddEvent}><Icon name="plus" size={14} />Add a plan</button><button className="secondary-button" onClick={onEditItinerary}>View all events <span className="plan-event-count">{events.length}</span></button></div></div>
      {sortedEvents.length ? <div className="plan-preview-list">{sortedEvents.slice(0, 5).map((event) => <button className="plan-preview-event" key={event.id} onClick={() => onEditEvent(event)}><span className="plan-preview-color" style={{ background: trip.color }} /><span className="plan-preview-date">{prettyDate(eventDay(event), { month: 'short', day: 'numeric' })}</span><span className="plan-preview-main"><strong>{event.title}</strong><small>{eventTypeLabel[event.type]}{event.location ? ` · ${event.location}` : ''}</small></span><span className="plan-preview-time">{eventTimeRange(event)}</span><Icon name="chevron" size={15} /></button>)}</div> : <div className="plan-empty"><p>No events in this trip yet. Add your first reservation, activity, or reminder.</p><button className="primary-button" onClick={onAddEvent}><Icon name="plus" size={15} />Add a plan</button></div>}
      {sortedEvents.length > 5 && <button className="plan-view-all" onClick={onEditItinerary}>View all {events.length} events</button>}
    </section>
  </section>
}

function ItineraryEditorPage({ trip, events, onBack, onAddEvent, onEditEvent, onDeleteEvent, onMoveEvent }: {
  trip: Trip
  events: PlanEvent[]
  onBack: () => void
  onAddEvent: () => void
  onEditEvent: (event: PlanEvent) => void
  onDeleteEvent: (id: string) => void
  onMoveEvent: (event: PlanEvent) => void
}) {
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const sortedEvents = [...events].sort((a, b) => a.start.localeCompare(b.start))
  const firstDate = [trip.startDate, ...events.map(eventDay)].sort()[0]
  const lastDate = [trip.endDate, ...events.map((event) => event.end?.slice(0, 10) ?? eventDay(event))].sort().at(-1) ?? trip.endDate
  const dayCount = Math.max(1, dayDistance(firstDate, lastDate) + 1)
  const days = Array.from({ length: dayCount }, (_, index) => dateOnly(shiftDate(new Date(`${firstDate}T12:00:00`), index)))
  const moveToDate = (eventId: string, targetDate: string) => {
    const event = events.find((item) => item.id === eventId)
    if (!event) return
    const difference = dayDistance(eventDay(event), targetDate)
    if (!difference) return
    onMoveEvent({
      ...event,
      start: shiftDateTime(event.start, difference),
      ...(event.end ? { end: shiftDateTime(event.end, difference) } : {}),
    })
  }
  const handleDrop = (dragEvent: ReactDragEvent<HTMLDivElement>, date: string) => {
    dragEvent.preventDefault()
    moveToDate(dragEvent.dataTransfer.getData('text/plain'), date)
    setDragOverDate(null)
  }

  return <section className="itinerary-editor-page">
    <button className="back-link" onClick={onBack}><Icon name="left" size={15} />Back to {trip.name}</button>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />ITINERARY EDITOR</div><h1>Make it your own<span>.</span></h1><p>Drag a plan to another day, or edit and remove it directly.</p></div><button className="primary-button" onClick={onAddEvent}><Icon name="plus" size={16} />Add a plan</button></div>
    <div className="editor-trip-summary"><span className="trip-dot" style={{ backgroundColor: trip.color }} /><strong>{trip.name}</strong><span><Icon name="pinSmall" size={13} />{trip.destination}</span><span><Icon name="calendar" size={13} />{prettyDate(trip.startDate)} - {prettyDate(trip.endDate)}</span></div>
    <div className="itinerary-editor-days">{days.map((date) => {
      const dayEvents = sortedEvents.filter((event) => eventDay(event) === date)
      return <div key={date} className={`editor-day ${dragOverDate === date ? 'drop-active' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragOverDate(date) }} onDragLeave={() => setDragOverDate(null)} onDrop={(event) => handleDrop(event, date)}>
        <div className="editor-day-heading"><span className="editor-day-number">{prettyDate(date, { day: 'numeric' })}</span><div><strong>{prettyDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</strong><small>{dayEvents.length} {dayEvents.length === 1 ? 'plan' : 'plans'}</small></div></div>
        <div className="editor-day-events">{dayEvents.map((event) => <article key={event.id} className="editor-event" draggable onDragStart={(dragEvent) => { dragEvent.dataTransfer.effectAllowed = 'move'; dragEvent.dataTransfer.setData('text/plain', event.id) }}>
          <span className="editor-event-grip" aria-hidden="true">⋮⋮</span><span className="editor-event-type" style={{ color: trip.color }}>{eventTypeLabel[event.type]}</span><div className="editor-event-main"><strong>{event.title}</strong><span>{eventTimeRange(event)}{event.location ? ` · ${event.location}` : ''}</span></div>
          <div className="editor-event-actions"><button className="editor-event-edit" onClick={() => onEditEvent(event)}>Edit</button><button className="editor-event-delete" onClick={() => onDeleteEvent(event.id)}>Delete</button></div>
        </article>)}
        {!dayEvents.length && <div className="editor-empty-day">{dragOverDate === date ? 'Drop plan here' : 'Drop a plan here, or leave this day open.'}</div>}
        </div>
      </div>
    })}</div>
  </section>
}

function TripsView({ trips, events, onNew, onEdit, onNewEvent, onOpenPlan }: { trips: Trip[]; events: PlanEvent[]; onNew: () => void; onEdit: (trip: Trip) => void; onNewEvent: () => void; onOpenPlan: (tripId: string) => void }) {
  return <section className="trips-page"><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />COLLECT MOMENTS, NOT THINGS</div><h1>Everywhere, <span>eventually.</span></h1><p>Your trips, little plans, and the places you'll remember.</p></div><button className="primary-button" onClick={onNew}><Icon name="plus" size={17} />Plan a new trip</button></div>
    {trips.length ? <><div className="trips-overview"><div><span className="overview-number">{trips.length.toString().padStart(2, '0')}</span><span className="overview-label">TRIPS PLANNED</span></div><span className="overview-divider" /><div><span className="overview-number">{events.length.toString().padStart(2, '0')}</span><span className="overview-label">LITTLE MOMENTS</span></div><div className="overview-note">Somewhere new is always closer than it feels.</div></div>
    <div className="trip-cards">{trips.map((trip, index) => {
      const count = events.filter((event) => event.tripId === trip.id).length
      const status = trip.endDate < dateOnly(today) ? 'Been there' : trip.startDate <= dateOnly(today) ? 'On the way' : 'Coming up'
      return <article className={`trip-card trip-card-${index % 3}`} key={trip.id}><button className="trip-card-image" style={{ backgroundImage: `linear-gradient(180deg, transparent 38%, rgba(23,31,34,.5)), url("${trip.image || covers[index % covers.length]}")` }} onClick={() => onOpenPlan(trip.id)} aria-label={`Open ${trip.name}`}><span className="trip-status"><i style={{ background: trip.color }} />{status}</span><span className="trip-image-arrow"><Icon name="chevron" size={16} /></span></button><div className="trip-card-body"><div className="trip-card-meta"><span><Icon name="pinSmall" size={14} />{trip.destination}</span><button className="trip-menu" onClick={() => onEdit(trip)} aria-label={`Edit ${trip.name}`}><Icon name="more" size={19} /></button></div><button className="trip-card-title" onClick={() => onOpenPlan(trip.id)}>{trip.name}</button><div className="trip-card-footer"><span><Icon name="calendar" size={14} />{prettyDate(trip.startDate)} - {prettyDate(trip.endDate, { month: 'short', day: 'numeric', year: trip.endDate.slice(0, 4) !== trip.startDate.slice(0, 4) ? 'numeric' : undefined })}</span><span>{count} {count === 1 ? 'plan' : 'plans'}</span></div><button className="trip-open-plan" onClick={() => onOpenPlan(trip.id)}>Open trip plan<Icon name="chevron" size={14} /></button></div></article>
    })}</div></> : <div className="empty-trips"><span className="empty-stamp"><Icon name="pin" size={28} /></span><h2>A blank map is full of possibility.</h2><p>Start with a destination. The rest will come together.</p><button className="primary-button" onClick={onNew}><Icon name="plus" size={17} />Plan your first trip</button></div>}
    <button className="add-moment-banner" onClick={onNewEvent}><span className="banner-plus"><Icon name="plus" size={19} /></span><span><strong>A little something to look forward to?</strong><small>Add a plan, place, or reminder to your itinerary.</small></span><Icon name="chevron" size={18} /></button>
  </section>
}

function DialogFrame({ title, subtitle, onClose, children, className = '' }: { title: string; subtitle: string; onClose: () => void; children: ReactNode; className?: string }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className={`dialog ${className}`} role="dialog" aria-modal="true" aria-label={title}><button className="dialog-close" onClick={onClose} aria-label="Close dialog">×</button><div className="dialog-kicker">{APP_NAME.toUpperCase()} / YOUR JOURNEY</div><h2>{title}</h2><p className="dialog-subtitle">{subtitle}</p>{children}</section></div>
}

function EventDialog({ initial, trips, defaultTripId, onClose, onSave, onDelete, onEditPlan }: { initial: PlanEvent | null; trips: Trip[]; defaultTripId?: string; onClose: () => void; onSave: (event: PlanEvent) => void; onDelete: (id: string) => void; onEditPlan: (tripId: string) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [tripId, setTripId] = useState(initial?.tripId ?? defaultTripId ?? trips[0]?.id ?? '')
  const [type, setType] = useState<PlanEvent['type']>(initial?.type ?? 'activity')
  const [start, setStart] = useState(initial?.start ?? `${dateOnly(today)}T09:00`)
  const [end, setEnd] = useState(initial?.end ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim() || !start || (end && new Date(end) <= new Date(start))) return; onSave({ id: initial?.id ?? newId(), title: title.trim(), tripId, type, start, ...(end ? { end } : {}), location: location.trim(), note: note.trim() }) }
  return <DialogFrame title={initial ? 'A little adjustment' : 'Add to the itinerary'} subtitle={initial ? 'Plans change. Your itinerary can too.' : 'The best trips are made of little moments.'} onClose={onClose}><form className="dialog-form" onSubmit={submit}><label>What's the plan?<input required autoFocus={!initial} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Find the best matcha" /></label><div className="form-two"><label>Trip<select value={tripId} onChange={(event) => setTripId(event.target.value)}><option value="">No trip yet</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.name}</option>)}</select></label><label>Kind<select value={type} onChange={(event) => setType(event.target.value as PlanEvent['type'])}>{Object.entries(eventTypeLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div><div className="form-two"><label>Starts<input required type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Ends <span className="optional">(optional)</span><input type="datetime-local" min={start} value={end} onChange={(event) => setEnd(event.target.value)} /></label></div><label>Where? <span className="optional">(optional)</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Add a place or address" /></label><label>A note for later <span className="optional">(optional)</span><textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Confirmation number, what to bring, anything at all..." /></label><div className="dialog-actions">{initial && <button type="button" className="text-danger" onClick={() => onDelete(initial.id)}>Delete plan</button>}{initial && trips.some((trip) => trip.id === initial.tripId) && <button type="button" className="text-link" onClick={() => onEditPlan(initial.tripId)}>Edit plan</button>}<span /><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">{initial ? 'Save changes' : 'Add to plans'}</button></div></form></DialogFrame>
}

function TripEditorPage({ trip, onCancel, onSave, onDelete }: { trip: Trip; onCancel: () => void; onSave: (trip: Trip) => void; onDelete: (id: string) => void }) {
  return <section className="trip-editor-page">
    <button className="back-link" onClick={onCancel}><Icon name="left" size={15} />Back to {trip.name}</button>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />TRIP DETAILS</div><h1>Edit your trip<span>.</span></h1><p>Every good journey has room to change.</p></div></div>
    <div className="trip-editor-card"><TripForm initial={trip} onCancel={onCancel} onSave={onSave} onDelete={onDelete} /></div>
  </section>
}

function TripDialog({ initial, onClose, onSave, onDelete }: { initial: Trip | null; onClose: () => void; onSave: (trip: Trip) => void; onDelete: (id: string) => void }) {
  return <DialogFrame title={initial ? 'Edit your trip' : 'Somewhere new?'} subtitle={initial ? 'Every good journey has room to change.' : 'Start with the where. The when can follow.'} onClose={onClose}>
    <TripForm initial={initial} onCancel={onClose} onSave={onSave} onDelete={onDelete} />
  </DialogFrame>
}

function TripForm({ initial, onCancel, onSave, onDelete }: { initial: Trip | null; onCancel: () => void; onSave: (trip: Trip) => void; onDelete: (id: string) => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [destination, setDestination] = useState(initial?.destination ?? '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? dateOnly(shiftDate(today, 7)))
  const [endDate, setEndDate] = useState(initial?.endDate ?? dateOnly(shiftDate(today, 10)))
  const [color, setColor] = useState(initial?.color ?? palette[0])
  const [note, setNote] = useState(initial?.note ?? '')
  const submit = (event: FormEvent) => { event.preventDefault(); if (!name.trim() || !destination.trim() || endDate < startDate) return; onSave({ id: initial?.id ?? newId(), name: name.trim(), destination: destination.trim(), startDate, endDate, color, image: initial?.image ?? covers[Math.floor(Math.random() * covers.length)], note: note.trim() }) }
  return <form className="dialog-form" onSubmit={submit}><label>Give this trip a name<input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="A week somewhere wonderful" /></label><label>Where are you headed?<input required value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="City, country" /></label><div className="form-two"><label>Leaving<input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>Coming back<input required type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div><div className="color-field"><span>A color for this trip</span><div className="color-options">{palette.map((option) => <button type="button" key={option} className={`color-option ${color === option ? 'chosen' : ''}`} style={{ background: option }} onClick={() => setColor(option)} aria-label={`Choose ${option}`} />)}</div></div><label>A thought to take with you <span className="optional">(optional)</span><textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What are you looking forward to?" /></label><div className="dialog-actions">{initial && <button type="button" className="text-danger" onClick={() => onDelete(initial.id)}>Delete trip</button>}<span /><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" type="submit">{initial ? 'Save trip' : 'Create trip'}</button></div></form>
}

function AccountDialog({ account, onClose, onAuth, onRequestLogout, onSync, lastSync, autoSync, setAutoSync }: { account: Account | null; onClose: () => void; onAuth: (email: string, password: string, mode: 'login' | 'register') => Promise<void>; onRequestLogout: () => void; onSync: () => void; lastSync: string | null; autoSync: boolean; setAutoSync: (enabled: boolean) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState(account?.email ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); setBusy(true); try { await onAuth(email, password, mode) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not sign in.') } finally { setBusy(false) } }
  return <DialogFrame title={account ? 'Your account' : mode === 'login' ? 'Welcome back.' : 'Make it yours.'} subtitle={account ? 'Your plans stay yours, wherever you go.' : 'Sign in to keep your plans in sync across devices.'} onClose={onClose} className="account-dialog">{account ? <div className="account-settings"><div className="connected-account"><span className="account-check">✓</span><span><strong>{account.email}</strong><small>Connected and ready to sync</small></span></div><div className="sync-setting-row"><span><strong>Automatic sync</strong><small>Keep your latest plans backed up.</small></span><button className={`toggle ${autoSync ? 'on' : ''}`} onClick={() => setAutoSync(!autoSync)} aria-label="Toggle automatic sync"><i /></button></div><div className="last-sync-row"><span>Last synced</span><strong>{lastSync ? new Date(lastSync).toLocaleString() : 'Not synced yet'}</strong></div><div className="dialog-actions"><button className="text-danger" onClick={onRequestLogout}>Sign out</button><span /><button className="secondary-button" onClick={onClose}>Close</button><button className="primary-button" onClick={onSync}><Icon name="sync" size={15} />Sync now</button></div></div> : <form className="dialog-form" onSubmit={(event) => void submit(event)}><label>Email address<input required type="email" autoFocus autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Password<input required type="password" minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button auth-submit" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}</button><div className="auth-switch">{mode === 'login' ? `New to ${APP_NAME}?` : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></div><p className="offline-note">Your itinerary stays available offline, even when you're signed out.</p></form>}</DialogFrame>
}

export default App
