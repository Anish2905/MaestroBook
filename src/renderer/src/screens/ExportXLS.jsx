import { useState, useEffect } from 'react'
import { useToast } from '../hooks/useApi'
import { api } from '../api'

const EXPORTS = [
  { id: 'party-ledger', icon: '📋', title: 'Party Ledger', desc: 'All parties with contact info and opening balances', path: '/api/exports/party-ledger' },
  { id: 'invoice-register', icon: '🧾', title: 'Invoice Register', desc: 'All purchase and sale invoices with party details', path: '/api/exports/invoice-register' },
  { id: 'transaction-log', icon: '📊', title: 'Transaction Log', desc: 'Complete record of all payments and receipts', path: '/api/exports/transaction-log' },
  { id: 'outstanding-report', icon: '⚖️', title: 'Outstanding Report', desc: 'Payable and receivable balances by party', path: '/api/exports/outstanding-report' },
  { id: 'full-data', icon: '💾', title: 'Full Data Export', desc: 'All data sheets in one workbook — complete backup', path: '/api/exports/full-data', dashed: true }
]

export default function ExportXLS() {
  const toast = useToast()
  const [parties, setParties] = useState([])
  const [selectedPartyId, setSelectedPartyId] = useState('')

  useEffect(() => {
    api.getParties().then(setParties).catch(() => {})
  }, [])

  function handleExport(exp) {
    if (exp.path) {
      window.open(exp.path, '_blank')
    }
  }

  function handlePartyStatement() {
    if (!selectedPartyId) {
      toast('Please select a party first', 'error')
      return
    }
    window.open(`/api/exports/party-statement/${selectedPartyId}`, '_blank')
  }

  return (
    <div>
      <div className="grid-3 mb-16">
        {EXPORTS.map(exp => (
          <div
            key={exp.id}
            className={`export-card ${exp.dashed ? 'dashed' : ''}`}
            onClick={() => handleExport(exp)}
          >
            <div className="export-card-icon">{exp.icon}</div>
            <div className="export-card-title">{exp.title}</div>
            <div className="export-card-desc">{exp.desc}</div>
            <button className="btn btn-accent" style={{ width: '100%', justifyContent: 'center' }}>
              Download XLS
            </button>
          </div>
        ))}

        {/* Party Statement — needs party selector */}
        <div className="export-card">
          <div className="export-card-icon">📄</div>
          <div className="export-card-title">Party Statement</div>
          <div className="export-card-desc">Full account history for a single party</div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <select
              className="form-select"
              value={selectedPartyId}
              onChange={e => setSelectedPartyId(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 11 }}
            >
              <option value="">Select party…</option>
              {parties.map(p => (
                <option key={p.party_id} value={p.party_id}>{p.party_name}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-accent"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={handlePartyStatement}
          >
            Download XLS
          </button>
        </div>
      </div>
    </div>
  )
}

