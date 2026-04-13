import { useState, useEffect } from 'react'
import { formatCurrency, rupeeToPaise } from '../utils/format'
import { useToast } from '../hooks/useApi'
import { api } from '../api'

export default function BalanceTracker({ openModal }) {
  const [activeTab, setActiveTab] = useState('payable')
  const [payable, setPayable] = useState([])
  const [receivable, setReceivable] = useState([])
  const [showOverride, setShowOverride] = useState(false)
  const [overrideForm, setOverrideForm] = useState({ party_id: '', override_amount: '', reason: '' })
  const [allParties, setAllParties] = useState([])
  const toast = useToast()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [pay, rec, parties] = await Promise.all([
      api.getPayables(),
      api.getReceivables(),
      api.getParties()
    ])
    setPayable(pay)
    setReceivable(rec)
    setAllParties(parties)
  }

  function getProgressColor(pct) {
    if (pct > 66) return 'progress-green'
    if (pct > 33) return 'progress-amber'
    return 'progress-red'
  }

  async function handleOverrideSubmit() {
    if (!overrideForm.party_id || !overrideForm.override_amount || !overrideForm.reason) {
      toast('All fields are required for manual override', 'error')
      return
    }
    try {
      await api.createOverride({
        party_id: parseInt(overrideForm.party_id),
        override_amount: rupeeToPaise(overrideForm.override_amount),
        reason: overrideForm.reason
      })
      toast('Balance override applied', 'success')
      setShowOverride(false)
      setOverrideForm({ party_id: '', override_amount: '', reason: '' })
      loadData()
    } catch (err) {
      toast('Override failed: ' + err.message, 'error')
    }
  }

  const data = activeTab === 'payable' ? payable : receivable

  return (
    <div>
      <div className="card">
        {/* Tab bar + Manual Override button */}
        <div className="flex items-center justify-between" style={{ padding: '0 18px' }}>
          <div className="tab-bar" style={{ borderBottom: 'none' }}>
            <button
              className={`tab-item ${activeTab === 'payable' ? 'active' : ''}`}
              onClick={() => setActiveTab('payable')}
            >
              To Pay (Payable)
              <span className="tab-count">{payable.length}</span>
            </button>
            <button
              className={`tab-item ${activeTab === 'receivable' ? 'active' : ''}`}
              onClick={() => setActiveTab('receivable')}
            >
              To Get (Receivable)
              <span className="tab-count">{receivable.length}</span>
            </button>
          </div>
          <button className="btn btn-ghost-sm" onClick={() => setShowOverride(true)}>
            Manual Override
          </button>
        </div>
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>{activeTab === 'payable' ? 'Vendor' : 'Customer'}</th>
                  <th className="right">{activeTab === 'payable' ? 'Total Invoiced' : 'Total Billed'}</th>
                  <th className="right">{activeTab === 'payable' ? 'Total Paid' : 'Total Received'}</th>
                  <th className="right">Balance</th>
                  <th>{activeTab === 'payable' ? 'Cleared %' : 'Received %'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => {
                  const totalInvoiced = activeTab === 'payable'
                    ? row.total_invoiced + row.opening_balance
                    : row.total_billed + row.opening_balance
                  const totalPaid = activeTab === 'payable' ? row.total_paid : row.total_received
                  const balance = row.display_balance
                  const pct = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0

                  return (
                    <tr key={row.party_id}>
                      <td style={{ fontWeight: 500 }}>{row.party_name}</td>
                      <td className="right mono">{formatCurrency(totalInvoiced)}</td>
                      <td className="right mono">{formatCurrency(totalPaid)}</td>
                      <td className={`right mono ${activeTab === 'payable' ? 'text-red' : 'text-green'}`} style={{ fontWeight: 600 }}>
                        {formatCurrency(balance)}
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <div className="progress-bar-bg">
                          <div
                            className={`progress-bar-fill ${getProgressColor(pct)}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <div className="text-muted" style={{ fontSize: 9, marginTop: 3 }}>{pct}%</div>
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost-sm"
                          onClick={() => openModal(activeTab === 'payable' ? 'expense' : 'receipt', {
                            party_id: String(row.party_id)
                          })}
                        >
                          {activeTab === 'payable' ? '+ Pay' : '+ Receipt'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {data.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 30 }}>
                    No outstanding balances
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Manual Override Modal */}
      {showOverride && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowOverride(false) }}>
          <div className="modal-box">
            <div className="modal-title">Manual Balance Override</div>
            <div className="form-group">
              <label className="form-label">Party</label>
              <select className="form-select" value={overrideForm.party_id} onChange={e => setOverrideForm(p => ({ ...p, party_id: e.target.value }))}>
                <option value="">Select party…</option>
                {allParties.map(p => <option key={p.party_id} value={p.party_id}>{p.party_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Override Amount (₹)</label>
              <input className="form-input form-input-mono" type="number" step="0.01"
                value={overrideForm.override_amount}
                onChange={e => setOverrideForm(p => ({ ...p, override_amount: e.target.value }))}
                placeholder="Amount to adjust"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Reason (Mandatory)</label>
              <textarea className="form-textarea"
                value={overrideForm.reason}
                onChange={e => setOverrideForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Why is this override needed?"
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowOverride(false)}>Cancel</button>
              <button className="btn btn-accent" onClick={handleOverrideSubmit}>Apply Override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
