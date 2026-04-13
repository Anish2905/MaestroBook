import { useState, useEffect } from 'react'
import { formatCurrency, formatDate, paiseToRupee } from '../utils/format'
import { api } from '../api'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'transactions', label: 'Payments & Receipts' },
  { value: 'balance_overrides', label: 'Overrides' }
]

function getTypeBadge(type) {
  switch (type) {
    case 'Sale': return { cls: 'badge-blue', label: 'Sale' }
    case 'Purchase': return { cls: 'badge-red', label: 'Purchase' }
    case 'Payment Made': return { cls: 'badge-red', label: 'Payment' }
    case 'Receipt': return { cls: 'badge-green', label: 'Receipt' }
    case 'Override': return { cls: 'badge-purple', label: 'Override' }
    default: return { cls: 'badge-amber', label: type }
  }
}

function getAmountColor(type) {
  switch (type) {
    case 'Sale':
    case 'Receipt': return 'text-green'
    case 'Purchase':
    case 'Payment Made': return 'text-red'
    case 'Override': return 'text-purple'
    default: return ''
  }
}

function getAmountPrefix(type) {
  switch (type) {
    case 'Sale':
    case 'Receipt': return '+'
    case 'Purchase':
    case 'Payment Made': return '−'
    case 'Override': return '±'
    default: return ''
  }
}

export default function PartyLedger({ openModal }) {
  const [parties, setParties] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedParty, setSelectedParty] = useState(null)
  const [allTransactions, setAllTransactions] = useState([])
  const [deleteConfig, setDeleteConfig] = useState(null) // { type, id, title }
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadParties()
  }, [])

  async function loadParties() {
    const data = await api.getParties()
    setParties(data)
    if (data.length > 0 && !selectedId) {
      selectParty(data[0].party_id)
    }
  }

  async function selectParty(partyId) {
    setSelectedId(partyId)
    setFilter('all')
    const [party, txns] = await Promise.all([
      api.getParty(partyId),
      api.getPartyTransactions(partyId)
    ])
    setSelectedParty(party)
    setAllTransactions(txns)
  }

  async function confirmDeletion({ reason, deviceInfo }) {
    if (!deleteConfig) return
    const { type, id } = deleteConfig
    const payload = { reason, device_info: deviceInfo }

    if (type === 'party') {
      await api.deleteParty(id, payload)
      setSelectedId(null)
      setSelectedParty(null)
      setAllTransactions([])
      loadParties()
    } else if (type === 'invoice') {
      await api.deleteInvoice(id, payload)
      if (selectedId) selectParty(selectedId)
    } else if (type === 'transaction') {
      await api.deleteTransaction(id, payload)
      if (selectedId) selectParty(selectedId)
    }

    setDeleteConfig(null)
  }

  function handleDeleteParty(partyId) {
    setDeleteConfig({ type: 'party', id: partyId, title: `Party: ${selectedParty?.party_name}` })
  }

  function handleDeleteInvoice(invoiceId) {
    setDeleteConfig({ type: 'invoice', id: invoiceId, title: `Invoice #${invoiceId}` })
  }

  function handleDeleteTransaction(txnId) {
    setDeleteConfig({ type: 'transaction', id: txnId, title: `Transaction #${txnId}` })
  }

  const filteredParties = parties.filter(p =>
    p.party_name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredTransactions = allTransactions.filter(t => {
    if (filter === 'all') return true
    return t.source_table === filter
  })

  function getBalance(party) {
    if (!party) return 0
    if (party.party_type === 'Customer' || party.party_type === 'Both') {
      return party.total_sales + party.opening_balance - party.total_receipts
    }
    return party.total_purchases + party.opening_balance - party.total_payments
  }

  function handleEditInvoice(inv) {
    openModal('invoice', {
      editId: inv.source_id,
      party_id: String(selectedParty.party_id),
      invoice_number: inv.description,
      invoice_date: inv.date?.split(/[T\s]/)[0] || '',
      invoice_type: inv.type,
      amount: paiseToRupee(inv.amount),
      remarks: inv.remarks || ''
    })
  }

  function handleEditTransaction(txn) {
    const isReceipt = txn.type === 'Receipt'
    openModal(isReceipt ? 'receipt' : 'expense', {
      editId: txn.source_id,
      party_id: String(selectedParty.party_id),
      txn_date: txn.date?.split(/[T\s]/)[0] || '',
      txn_type: txn.type,
      category: txn.description || 'Miscellaneous',
      amount: paiseToRupee(txn.amount),
      remarks: txn.remarks || ''
    })
  }

  return (
    <div className="grid-1-2 party-ledger-layout">
      {/* Left: Party List */}
      <div className="card party-list-panel">
        <div className="party-list-search">
          <input
            className="form-input"
            placeholder="Search parties…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="party-list-items">
          {filteredParties.map(p => {
            const bal = getBalance(p)
            const isCustomer = p.party_type === 'Customer' || p.party_type === 'Both'
            return (
              <div
                key={p.party_id}
                className={`party-entry ${selectedId === p.party_id ? 'selected' : ''}`}
                onClick={() => selectParty(p.party_id)}
              >
                <div>
                  <div className="party-entry-name">{p.party_name}</div>
                  <div className="party-entry-type">{p.party_type}</div>
                </div>
                <span className={`badge ${isCustomer ? 'badge-green' : 'badge-red'}`} style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(Math.abs(bal))}
                </span>
              </div>
            )
          })}
          {filteredParties.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 30, fontSize: 12 }}>
              {parties.length === 0 ? 'No parties yet. Click "+ New Entry" → New Party to add one.' : 'No matching parties.'}
            </div>
          )}
        </div>
      </div>

      {/* Right: Party Detail */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {selectedParty ? (
          <>
            {/* Party Header */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedParty.party_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                    {selectedParty.phone && `${selectedParty.phone} · `}{selectedParty.address || ''}
                  </div>
                </div>
                <div className="flex gap-8">
                  <button className="btn btn-danger-sm" onClick={() => handleDeleteParty(selectedParty.party_id)}>
                    Delete
                  </button>
                  <button className="btn btn-ghost-sm" onClick={() => openModal('party', {
                    editId: selectedParty.party_id,
                    party_name: selectedParty.party_name,
                    party_type: selectedParty.party_type,
                    phone: selectedParty.phone || '',
                    address: selectedParty.address || '',
                    notes: selectedParty.notes || '',
                    opening_balance: paiseToRupee(selectedParty.opening_balance)
                  })}>
                    Edit
                  </button>
                  <button className="btn btn-accent-sm" onClick={() => openModal('invoice', { party_id: String(selectedParty.party_id) })}>
                    + Add Invoice
                  </button>
                </div>
              </div>

              <div className="party-stats-row">
                <div className="party-stat-box">
                  <div className="party-stat-label">Total Billed</div>
                  <div className="party-stat-value text-blue">
                    {formatCurrency(selectedParty.total_sales + selectedParty.total_purchases)}
                  </div>
                </div>
                <div className="party-stat-box">
                  <div className="party-stat-label">Total Received / Paid</div>
                  <div className="party-stat-value text-green">
                    {formatCurrency(selectedParty.total_receipts + selectedParty.total_payments)}
                  </div>
                </div>
                <div className="party-stat-box">
                  <div className="party-stat-label">Balance Outstanding</div>
                  <div className="party-stat-value text-amber">
                    {formatCurrency(Math.abs(getBalance(selectedParty)))}
                  </div>
                </div>
              </div>
            </div>

            {/* Full Transaction History */}
            <div className="card" style={{ flex: 1, overflow: 'hidden' }}>
              <div className="card-header">
                <span className="card-title">Full Transaction History</span>
                <span className="text-muted" style={{ fontSize: 10 }}>{filteredTransactions.length} entries</span>
              </div>

              {/* Filter Pills */}
              <div className="filter-pills">
                {FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`filter-pill ${filter === opt.value ? 'active' : ''}`}
                    onClick={() => setFilter(opt.value)}
                  >
                    {opt.label}
                    {opt.value !== 'all' && (
                      <span className="filter-pill-count">
                        {allTransactions.filter(t =>
                          opt.value === 'all' ? true : t.source_table === opt.value
                        ).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="card-body" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th className="right">Amount</th>
                        <th>Remarks</th>
                        <th style={{ width: 80 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((txn, idx) => {
                        const badge = getTypeBadge(txn.type)
                        const amtColor = getAmountColor(txn.type)
                        const prefix = getAmountPrefix(txn.type)
                        return (
                          <tr key={`${txn.source_table}-${txn.source_id}-${idx}`}>
                            <td className="mono muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                              {formatDate(txn.date)}
                            </td>
                            <td>
                              <span className={`badge ${badge.cls}`}>{badge.label}</span>
                            </td>
                            <td style={{ fontSize: 12 }}>{txn.description || '—'}</td>
                            <td className={`right mono ${amtColor}`} style={{ fontWeight: 500 }}>
                              {prefix}{formatCurrency(txn.amount)}
                            </td>
                            <td className="muted" style={{ fontSize: 11, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {txn.remarks || '—'}
                            </td>
                            <td>
                              <div className="flex gap-4" style={{ justifyContent: 'flex-end' }}>
                                {txn.source_table === 'invoices' && (
                                  <>
                                    <button
                                      className="btn btn-ghost-sm"
                                      style={{ padding: '3px 6px', fontSize: 10 }}
                                      title="Edit invoice"
                                      onClick={() => handleEditInvoice(txn)}
                                    >✎</button>
                                    <button
                                      className="btn btn-danger-sm"
                                      style={{ padding: '3px 6px', fontSize: 11 }}
                                      title="Delete invoice"
                                      onClick={() => handleDeleteInvoice(txn.source_id)}
                                    >✕</button>
                                  </>
                                )}
                                {txn.source_table === 'transactions' && (
                                  <>
                                    <button
                                      className="btn btn-ghost-sm"
                                      style={{ padding: '3px 6px', fontSize: 10 }}
                                      title="Edit transaction"
                                      onClick={() => handleEditTransaction(txn)}
                                    >✎</button>
                                    <button
                                      className="btn btn-danger-sm"
                                      style={{ padding: '3px 6px', fontSize: 11 }}
                                      title="Delete transaction"
                                      onClick={() => handleDeleteTransaction(txn.source_id)}
                                    >✕</button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {filteredTransactions.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No transactions found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            {parties.length === 0 ? 'Add your first party using "+ New Entry" → New Party' : 'Select a party from the list'}
          </div>
        )}
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
