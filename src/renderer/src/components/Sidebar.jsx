import { useMemo } from 'react'
import logo from '../assets/logo.png'

const NAV_ITEMS = [
  {
    group: 'MAIN',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '◫' },
      { id: 'partyLedger', label: 'Party Ledger', icon: '⊞' },
      { id: 'expenses', label: 'Expenses & Receipts', icon: '⇅' },
      { id: 'balanceTracker', label: 'Balance Tracker', icon: '☰' }
    ]
  },
  {
    group: 'TOOLS',
    items: [
      { id: 'exportXLS', label: 'Export to XLS', icon: '↗' },
      { id: 'auditLog', label: 'Audit Log', icon: '⊙' },
      { id: 'settings', label: 'Settings', icon: '⚙' }
    ]
  }
]

export default function Sidebar({ activeScreen, onNavigate, backupInfo, isOpen, onClose }) {
  const backupDisplay = useMemo(() => {
    return {
      line1: '✓ Auto-synced',
      line2: 'Turso Cloud'
    }
  }, [backupInfo])

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={onClose} />
      <div className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <img src={logo} className="sidebar-logo" alt="Maestro Logo" />
          <div className="sidebar-brand-name">Maestro Engineering</div>
          <div className="sidebar-brand-sub">BOOKKEEPING · FY 2025–26</div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(group => (
            <div key={group.group}>
              <div className="nav-label">{group.group}</div>
              {group.items.map(item => (
                <button
                  key={item.id}
                  className={`nav-item ${activeScreen === item.id ? 'active' : ''}`}
                  onClick={() => onNavigate(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="backup-chip">
            <div className="backup-chip-line1">{backupDisplay.line1}</div>
            <div className="backup-chip-line2">{backupDisplay.line2}</div>
          </div>
        </div>
      </div>
    </>
  )
}
