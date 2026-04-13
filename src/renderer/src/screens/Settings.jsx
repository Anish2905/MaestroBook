import { useState, useEffect } from 'react'
import { useToast } from '../hooks/useApi'
import { api } from '../api'

export default function Settings() {
  const [settings, setSettings] = useState({ company_name: '', fy_start: 'April', backup_retain_count: '30' })
  const [dbInfo, setDbInfo] = useState(null)
  const toast = useToast()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [s, info] = await Promise.all([
      api.getSettings(),
      api.getDbInfo()
    ])
    setSettings(prev => ({ ...prev, ...s }))
    setDbInfo(info)
  }

  async function saveSettings() {
    try {
      await api.updateSetting('company_name', settings.company_name)
      await api.updateSetting('fy_start', settings.fy_start)
      toast('Settings saved', 'success')
    } catch (err) {
      toast('Failed to save: ' + err.message, 'error')
    }
  }

  function handleBackupNow() {
    toast('Cloud database is automatically synchronized via Turso.', 'success')
  }

  function handleRestore() {
    toast('Restore is not available in the web version. Contact your administrator.', 'error')
  }

  return (
    <div className="settings-grid">
      {/* Company Details */}
      <div className="settings-panel">
        <div className="settings-panel-title">Company Details</div>
        <div className="form-group">
          <label className="form-label">Company Name</label>
          <input
            className="form-input"
            value={settings.company_name || ''}
            onChange={e => setSettings(p => ({ ...p, company_name: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Financial Year Start</label>
          <select
            className="form-select"
            value={settings.fy_start || 'April'}
            onChange={e => setSettings(p => ({ ...p, fy_start: e.target.value }))}
          >
            {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-accent" onClick={saveSettings}>Save Changes</button>
      </div>

      {/* Backup Settings */}
      <div className="settings-panel">
        <div className="settings-panel-title">Backup Settings</div>
        <div className="form-group">
          <label className="form-label">Storage</label>
          <input className="form-input" value="Turso Cloud Database" disabled />
        </div>
        <div className="form-group">
          <label className="form-label">Backups to Retain</label>
          <input
            className="form-input form-input-mono"
            type="number"
            value={settings.backup_retain_count || '30'}
            onChange={e => setSettings(p => ({ ...p, backup_retain_count: e.target.value }))}
          />
        </div>
        <div className="flex gap-10">
          <button className="btn btn-accent" onClick={handleBackupNow}>Backup Now</button>
          <button className="btn btn-ghost" onClick={handleRestore}>Restore from Backup</button>
        </div>
      </div>

      {/* Database Info */}
      <div className="settings-panel">
        <div className="settings-panel-title">Database Info</div>
        {dbInfo ? (
          <div className="stat-grid">
            <div className="stat-box">
              <div className="stat-box-label">DB Size</div>
              <div className="stat-box-value">{dbInfo.sizeMb}</div>
            </div>
            <div className="stat-box">
              <div className="stat-box-label">Total Records</div>
              <div className="stat-box-value">{dbInfo.totalRecords}</div>
            </div>
            <div className="stat-box">
              <div className="stat-box-label">DB Integrity</div>
              <div className={`stat-box-value ${dbInfo.integrityOk ? 'text-green' : 'text-red'}`}>
                {dbInfo.integrityOk ? '✓ OK' : '✗ Error'}
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-box-label">Auto-Save</div>
              <div className="stat-box-value text-green">✓ Active</div>
            </div>
          </div>
        ) : (
          <div className="text-muted">Loading…</div>
        )}
      </div>

      {/* App Info */}
      <div className="settings-panel">
        <div className="settings-panel-title">App Info</div>
        <div className="kv-list">
          <div className="kv-row">
            <span className="kv-key">Version</span>
            <span className="kv-value">2.0.0</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Built for</span>
            <span className="kv-value">Web Application</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Database engine</span>
            <span className="kv-value">Turso (LibSQL)</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Platform</span>
            <span className="kv-value">Web (React + Express)</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Font Stack</span>
            <span className="kv-value">Sora + DM Mono</span>
          </div>
        </div>
      </div>
    </div>
  )
}
