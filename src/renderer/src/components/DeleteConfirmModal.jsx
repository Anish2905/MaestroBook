import { useState } from 'react'

export default function DeleteConfirmModal({ title, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  function handleSubmit() {
    if (!reason.trim()) {
      setError('A reason for deletion is mandatory.')
      return
    }

    // Capture device info
    const platform = window.navigator.userAgentData?.platform || window.navigator.platform
    const vendor = window.navigator.vendor
    const isMobile = /Mobi|Android/i.test(navigator.userAgent)
    const deviceInfo = `${platform}${vendor ? ` (${vendor})` : ''}${isMobile ? ' [Mobile]' : ' [Desktop]'}`

    onConfirm({ reason, deviceInfo })
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal-box" style={{ maxWidth: 400 }}>
        <div className="modal-title" style={{ color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚠</span> Confirm Deletion
        </div>
        
        <div style={{ fontSize: 13, marginBottom: 16, color: 'var(--text)', opacity: 0.9 }}>
          You are about to delete: <strong>{title}</strong>. This action is irreversible and will be logged with your device signature.
        </div>

        <div className="form-group">
          <label className="form-label">Reason for Deletion</label>
          <textarea
            className="form-textarea"
            placeholder="e.g. Data entry error, Duplicate record..."
            value={reason}
            onChange={e => { setReason(e.target.value); setError('') }}
            autoFocus
          />
          {error && <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 4 }}>{error}</div>}
        </div>

        <div style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--card2)', padding: '8px 12px', borderRadius: 6, marginBottom: 4 }}>
          <strong>Device Trail:</strong> {window.navigator.userAgentData?.platform || window.navigator.platform} User Agent
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={handleSubmit}>Confirm & Delete</button>
        </div>
      </div>
    </div>
  )
}
