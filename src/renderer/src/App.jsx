import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from './api'
import { ToastProvider, useToast } from './hooks/useApi'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import NewEntryModal from './components/NewEntryModal'
import Dashboard from './screens/Dashboard'
import PartyLedger from './screens/PartyLedger'
import Expenses from './screens/Expenses'
import BalanceTracker from './screens/BalanceTracker'
import ExportXLS from './screens/ExportXLS'
import AuditLog from './screens/AuditLog'
import Settings from './screens/Settings'

const SCREENS = {
  dashboard: { title: 'Dashboard', component: Dashboard },
  partyLedger: { title: 'Party Ledger', component: PartyLedger },
  expenses: { title: 'Expenses & Receipts', component: Expenses },
  balanceTracker: { title: 'Balance Tracker', component: BalanceTracker },
  exportXLS: { title: 'Export to XLS', component: ExportXLS },
  auditLog: { title: 'Audit Log', component: AuditLog },
  settings: { title: 'Settings', component: Settings }
}

function AppInner() {
  const [activeScreen, setActiveScreen] = useState('dashboard')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState(null)
  const [modalData, setModalData] = useState(null)
  const [backupInfo, setBackupInfo] = useState(null)
  const [integrityOk, setIntegrityOk] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const toast = useToast()

  // Cloud sync
  useEffect(() => {
    // Web version runs via API, no local file backups needed
    // Assuming backend will manage integrity.
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        openModal()
      }
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        handleBackupNow()
      }
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault()
        setActiveScreen('exportXLS')
      }
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        document.getElementById('topbar-search')?.focus()
      }
      if (e.key === 'Escape') {
        setShowModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const openModal = useCallback((type, data) => {
    setModalType(type || null)
    setModalData(data || null)
    setShowModal(true)
  }, [])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setModalType(null)
    setModalData(null)
  }, [])

  const handleSaved = useCallback(() => {
    closeModal()
    setRefreshKey(k => k + 1)
    toast('Entry saved successfully', 'success')
  }, [closeModal, toast])

  const handleBackupNow = useCallback(async () => {
    toast('Cloud database is automatically synchronized.', 'success')
  }, [toast])

  const triggerRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  const screen = SCREENS[activeScreen]
  const ScreenComponent = screen.component

  return (
    <div className="app-layout">
      <Sidebar
        activeScreen={activeScreen}
        onNavigate={(screen) => {
          setActiveScreen(screen)
          setIsSidebarOpen(false)
        }}
        backupInfo={backupInfo}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="main-area">
        {!integrityOk && (
          <div className="integrity-banner">
            ⚠ Database integrity check failed. Please restore from a backup in Settings.
          </div>
        )}
        <Topbar
          title={screen.title}
          onNewEntry={() => openModal()}
          onBackupNow={handleBackupNow}
          onMenuClick={() => setIsSidebarOpen(true)}
        />
        <div className="content-area">
          <ScreenComponent
            key={refreshKey}
            openModal={openModal}
            triggerRefresh={triggerRefresh}
            onNavigate={setActiveScreen}
          />
        </div>
      </div>
      {showModal && (
        <NewEntryModal
          onClose={closeModal}
          onSaved={handleSaved}
          initialType={modalType}
          initialData={modalData}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}
