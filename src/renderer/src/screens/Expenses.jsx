import { useState, useEffect } from 'react'
import { formatCurrency, formatDate, getTypeBadgeClass } from '../utils/format'
import { api } from '../api'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

export default function Expenses({ openModal }) {
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState({ outgoing: 0, incoming: 0, netCashFlow: 0 })
  const [categories, setCategories] = useState([])
  const [filterCategory, setFilterCategory] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [deleteConfig, setDeleteConfig] = useState(null)

  useEffect(() => {
    loadData()
  }, [filterCategory, filterMonth])

  async function loadData() {
    const filters = {}
    if (filterCategory) filters.category = filterCategory
    if (filterMonth) filters.month = filterMonth

    const [txns, sum, cats] = await Promise.all([
      api.getTransactions(filters),
      api.getExpensesSummary(filters),
      api.getExpenseCategories()
    ])
    setTransactions(txns)
    setSummary(sum)
    setCategories(cats)
  }

  async function confirmDeletion({ reason, deviceInfo }) {
    if (!deleteConfig) return
    await api.deleteTransaction(deleteConfig.id, { reason, device_info: deviceInfo })
    setDeleteConfig(null)
    loadData()
  }

  function handleDelete(txnId) {
    const txn = transactions.find(t => t.txn_id === txnId)
    setDeleteConfig({ id: txnId, title: `Transaction: ${txn?.category || 'General'} - ${formatCurrency(txn?.amount || 0)}` })
  }

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex items-center justify-between mb-16">
        <div style={{ fontSize: 14, fontWeight: 600 }}>All Transactions</div>
        <div className="filter-bar">
          <select
            className="form-select"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="month"
            className="form-input form-input-mono"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            style={{ width: 160 }}
          />
          <button className="btn btn-ghost-sm" onClick={() => { setFilterCategory(''); setFilterMonth('') }}>
            Clear
          </button>
          <button className="btn btn-accent-sm" onClick={() => openModal('expense')}>
            + Add Entry
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid-3 mb-16">
        <div className="metric-card metric-card-red" style={{ padding: '14px 18px' }}>
          <div className="metric-label">Total Outgoing</div>
          <div className="metric-value metric-value-red" style={{ fontSize: 18 }}>{formatCurrency(summary.outgoing)}</div>
        </div>
        <div className="metric-card metric-card-green" style={{ padding: '14px 18px' }}>
          <div className="metric-label">Total Incoming</div>
          <div className="metric-value metric-value-green" style={{ fontSize: 18 }}>{formatCurrency(summary.incoming)}</div>
        </div>
        <div className="metric-card metric-card-amber" style={{ padding: '14px 18px' }}>
          <div className="metric-label">Net Cash Flow</div>
          <div className="metric-value metric-value-amber" style={{ fontSize: 18 }}>{formatCurrency(summary.netCashFlow)}</div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Party / Category</th>
                  <th>Type</th>
                  <th>Remarks</th>
                  <th className="right">Amount</th>
                  <th style={{ width: 70 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(txn => (
                  <tr key={txn.txn_id}>
                    <td className="mono muted" style={{ fontSize: 10 }}>T-{String(txn.txn_id).padStart(4, '0')}</td>
                    <td className="mono muted" style={{ fontSize: 11 }}>{formatDate(txn.txn_date)}</td>
                    <td>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{txn.party_name || '—'}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{txn.category}</div>
                    </td>
                    <td>
                      <span className={`badge ${getTypeBadgeClass(txn.txn_type)}`}>
                        {txn.txn_type}
                      </span>
                    </td>
                    <td className="muted" style={{ fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {txn.remarks || '—'}
                    </td>
                    <td className={`right mono ${txn.txn_type === 'Receipt' ? 'text-green' : 'text-red'}`} style={{ fontWeight: 500 }}>
                      {txn.txn_type === 'Receipt' ? '+' : '−'}{formatCurrency(txn.amount)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-ghost-sm"
                          style={{ padding: '3px 6px', fontSize: 12 }}
                          title="Edit"
                          onClick={() => openModal(txn.txn_type === 'Receipt' ? 'receipt' : 'expense', {
                            editId: txn.txn_id,
                            txn_date: txn.txn_date,
                            category: txn.category,
                            party_id: txn.party_id ? String(txn.party_id) : '',
                            amount: (txn.amount / 100).toFixed(2),
                            remarks: txn.remarks,
                            txn_type: txn.txn_type
                          })}
                        >
                          ✎
                        </button>
                        <button
                          className="btn btn-danger-sm"
                          style={{ padding: '3px 6px', fontSize: 12 }}
                          title="Delete"
                          onClick={() => handleDelete(txn.txn_id)}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 30 }}>No transactions found. Click "+ Add Entry" to get started.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {deleteConfig && (
        <DeleteConfirmModal
          title={deleteConfig.title}
          onConfirm={confirmDeletion}
          onCancel={() => setDeleteConfig(null)}
        />
      )}
    </div>
  )
}
