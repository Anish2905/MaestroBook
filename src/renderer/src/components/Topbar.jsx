import { useState, useRef, useEffect } from 'react'
import { api } from '../api'
import { syncEvents, isOnline, queueDB, syncQueue } from '../utils/syncManager'
import logo from '../assets/logo.png'

export default function Topbar({ title, onNewEntry, onBackupNow, onMenuClick }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState(null)
  const [showResults, setShowResults] = useState(false)
  const [syncStatus, setSyncStatus] = useState('Online') // 'Online', 'Offline', 'Syncing'
  const [pendingItems, setPendingItems] = useState(0)
  const [conflictItems, setConflictItems] = useState(0)
  
  const searchRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    async function updateStatus() {
      const keys = await queueDB.keys()
      
      let conflicts = 0
      for (const key of keys) {
        const item = await queueDB.getItem(key)
        if (item?.conflict) conflicts++
      }
      
      setPendingItems(keys.length)
      setConflictItems(conflicts)
      
      if (!await isOnline()) {
        setSyncStatus('Offline')
      } else if (keys.length === 0) {
        setSyncStatus('Online')
      }
    }
    
    updateStatus()

    const handleSyncStarted = () => setSyncStatus('Syncing')
    const handleSyncComplete = () => updateStatus()
    const handleQueueUpdated = () => updateStatus()
    const handleOnlineStatus = () => updateStatus()

    syncEvents.addEventListener('syncStarted', handleSyncStarted)
    syncEvents.addEventListener('syncComplete', handleSyncComplete)
    syncEvents.addEventListener('queueUpdated', handleQueueUpdated)
    syncEvents.addEventListener('onlineStatus', handleOnlineStatus)

    return () => {
      syncEvents.removeEventListener('syncStarted', handleSyncStarted)
      syncEvents.removeEventListener('syncComplete', handleSyncComplete)
      syncEvents.removeEventListener('queueUpdated', handleQueueUpdated)
      syncEvents.removeEventListener('onlineStatus', handleOnlineStatus)
    }
  }, [])

  function handleSearchChange(e) {
    const q = e.target.value
    setSearch(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) {
      setResults(null)
      setShowResults(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.searchGlobal(q)
        setResults(res)
        setShowResults(true)
      } catch (err) {
        console.error('Search error:', err)
      }
    }, 300)
  }

  function handleSyncClick() {
    if (syncStatus === 'Offline') {
      alert('You are currently offline. Changes will sync when network is restored.')
    } else {
      syncQueue('/api')
      if (onBackupNow) onBackupNow()
    }
  }

  const hasResults = results && ((results.parties?.length || 0) + (results.invoices?.length || 0)) > 0

  return (
    <div className="topbar">
      <button className="mobile-menu-btn" onClick={onMenuClick}>☰</button>
      <img src={logo} className="topbar-logo" alt="Logo" />
      <div className="topbar-title">{title}</div>
      <div className="topbar-spacer" />
      <div className="topbar-search-wrapper" ref={searchRef}>
        <input
          id="topbar-search"
          type="text"
          className="topbar-search"
          placeholder="Search parties, invoices…"
          value={search}
          onChange={handleSearchChange}
          onFocus={() => results && setShowResults(true)}
        />
        {showResults && (
          <div className="search-dropdown">
            {hasResults ? (
              <>
                {results.parties?.length > 0 && (
                  <div className="search-section">
                    <div className="search-section-title">Parties</div>
                    {results.parties.map(p => (
                      <div key={p.party_id} className="search-result-item">
                        <span>{p.party_name}</span>
                        <span className="badge badge-amber" style={{ fontSize: 9 }}>{p.party_type}</span>
                      </div>
                    ))}
                  </div>
                )}
                {results.invoices?.length > 0 && (
                  <div className="search-section">
                    <div className="search-section-title">Invoices</div>
                    {results.invoices.map(i => (
                      <div key={i.invoice_id} className="search-result-item">
                        <span>{i.invoice_number || `#${i.invoice_id}`}</span>
                        <span className="text-muted" style={{ fontSize: 10 }}>{i.party_name} · {i.invoice_type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
                No results found
              </div>
            )}
          </div>
        )}
      </div>
      <button className="btn btn-ghost" onClick={onNewEntry}>
        + New Entry
      </button>
      <button 
        className={syncStatus === 'Offline' ? "btn btn-ghost" : "btn btn-accent"} 
        onClick={handleSyncClick}
        style={syncStatus === 'Syncing' ? { opacity: 0.6 } : {}}
      >
        {syncStatus === 'Offline' && pendingItems > 0 && `☁ Offline (${pendingItems})`}
        {syncStatus === 'Offline' && pendingItems === 0 && `☁ Offline`}
        {syncStatus === 'Syncing' && `☁ Syncing...`}
        {syncStatus === 'Online' && pendingItems > 0 && `☁ Syncing...`}
        {syncStatus === 'Online' && pendingItems === 0 && `☁ Synced`}
      </button>
      {conflictItems > 0 && (
        <div style={{ color: 'var(--red)', fontSize: 12, fontWeight: 500, padding: '4px 10px', background: 'var(--red-dim)', borderRadius: 6, marginLeft: 8 }}>
          {conflictItems} Conflict{conflictItems > 1 ? 's' : ''} Detected
        </div>
      )}
    </div>
  )
}

