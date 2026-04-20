import { useState, useEffect } from 'react'
import { formatCurrency, formatDate, paiseToRupee } from '../utils/format'
import { api } from '../api'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

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
  const [deleteConfig, setDeleteConfig] = useState(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('transactions') // Default to 'transactions' (Payments & Receipts) exactly as user requested!

  useEffect(() => {
    loadParties()
  }, [])

  async function loadParties() {
    const data = await api.getParties()
    setParties(data)
  }

  async function selectParty(partyId) {
    setSelectedId(partyId)
    const [party, txns] = await Promise.all([
      api.getParty(partyId),
      api.getPartyTransactions(partyId)
    ])
    setSelectedParty(party)
    setAllTransactions(txns)
  }

  function handleBack() {
    setSelectedId(null)
    setSelectedParty(null)
    setAllTransactions([])
  }

  async function confirmDeletion({ reason, deviceInfo }) {
    if (!deleteConfig) return
    const { type, id } = deleteConfig
    const payload = { reason, device_info: deviceInfo }

    if (type === 'party') {
      await api.deleteParty(id, payload)
      handleBack()
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

  const filteredParties = parties.filter(p =>
    p.party_name.toLowerCase().includes(search.toLowerCase())
  )

  const transactionsList = allTransactions.filter(t => t.source_table === 'transactions')
  const invoicesList = allTransactions.filter(t => t.source_table === 'invoices')

  const currentList = activeTab === 'transactions' ? transactionsList : invoicesList

  function getBalance(party) {
    if (!party) return 0;
    let bal = 0;
    if (party.party_type === 'Customer') {
      bal = party.total_sales + party.opening_balance - party.total_receipts - (party.total_overrides || 0);
    } else if (party.party_type === 'Vendor') {
      bal = -(party.total_purchases + party.opening_balance - party.total_payments + (party.total_overrides || 0));
    } else {
      bal = (party.total_sales + party.opening_balance - party.total_receipts) -
            (party.total_purchases - party.total_payments) -
            (party.total_overrides || 0);
    }
    return bal;
  }

  if (!selectedParty) {
    return (
      <div className="mobile-party-list-container">
        <div className="search-header">
          <input
            className="mobile-search-input"
            placeholder="Search parties..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="mobile-party-list">
          {filteredParties.map(p => {
            const bal = getBalance(p)
            return (
              <div key={p.party_id} className="mobile-party-item" onClick={() => selectParty(p.party_id)}>
                <div className="party-item-info">
                  <div className="party-name">{p.party_name}</div>
                  <div className="party-type">{p.party_type}</div>
                </div>
                <div className={`party-bal ${bal >= 0 ? 'text-green' : 'text-red'}`}>
                  {formatCurrency(Math.abs(bal))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-ledger-container">
      {/* Header */}
      <div className="ledger-header">
        <button className="btn-back" onClick={handleBack}>← Back</button>
        <div className="header-actions">
          <button className="btn-icon" onClick={() => openModal('party', {
            editId: selectedParty.party_id,
            party_name: selectedParty.party_name,
            party_type: selectedParty.party_type,
            phone: selectedParty.phone,
            address: selectedParty.address,
            notes: selectedParty.notes,
            opening_balance: paiseToRupee(selectedParty.opening_balance)
          })}>✎</button>
          <button className="btn-icon text-red" onClick={() => setDeleteConfig({ type: 'party', id: selectedParty.party_id, title: selectedParty.party_name })}>✕</button>
        </div>
      </div>

      <div className="ledger-title-section">
        <h1 className="ledger-party-name">{selectedParty.party_name}</h1>
        <p className="ledger-party-meta">{selectedParty.phone || 'No phone'} · {selectedParty.address || 'No location'}</p>
      </div>

      {/* Stats Cards */}
      <div className="ledger-stats">
        <div className="ledger-stat-card">
          <div className="ledger-stat-label">Total Billed</div>
          <div className="ledger-stat-value text-blue">{formatCurrency(selectedParty.total_sales + selectedParty.total_purchases)}</div>
        </div>
        <div className="ledger-stat-card">
          <div className="ledger-stat-label">Total Received</div>
          <div className="ledger-stat-value text-green">{formatCurrency(selectedParty.total_receipts + selectedParty.total_payments)}</div>
        </div>
        <div className="ledger-stat-card border-accent">
          <div className="ledger-stat-label">Balance</div>
          <div className="ledger-stat-value">{formatCurrency(Math.abs(getBalance(selectedParty)))}</div>
        </div>
      </div>

      {/* Segmented Control (Tabs) */}
      <div className="segmented-control">
        <button 
          className={`segment ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          Payments History ({transactionsList.length})
        </button>
        <button 
          className={`segment ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setActiveTab('invoices')}
        >
          Invoices ({invoicesList.length})
        </button>
      </div>

      {/* History List */}
      <div className="ledger-history-list">
        {currentList.map((item, idx) => {
          const isTxn = item.source_table === 'transactions'
          const amtColor = getAmountColor(item.type)
          const prefix = getAmountPrefix(item.type)
          return (
            <div className="history-item-card" key={idx}>
              <div className="history-top-row">
                <div className="history-date">{formatDate(item.date)}</div>
                <div className={`history-amount ${amtColor}`}>{prefix}{formatCurrency(item.amount)}</div>
              </div>
              <div className="history-mid-row">
                <span className={`badge-minimal ${item.type.replace(' ', '')}`}>{item.type}</span>
                <div className="history-desc">{item.description || '—'}</div>
              </div>
              {item.remarks && <div className="history-remark">Note: {item.remarks}</div>}
              
              <div className="history-actions">
                <button className="btn-ghost-mini" onClick={() => {
                  const typeKey = item.type === 'Receipt' ? 'receipt' : item.type === 'Payment Made' ? 'expense' : 'invoice'
                  openModal(typeKey, {
                    editId: item.source_id,
                    party_id: String(selectedParty.party_id),
                    [typeKey === 'invoice' ? 'invoice_date' : 'txn_date']: item.date.split(/[T\s]/)[0],
                    amount: paiseToRupee(item.amount),
                    remarks: item.remarks || '',
                    ...(typeKey === 'invoice' ? { invoice_number: item.description, invoice_type: item.type } : { txn_type: item.type, category: item.description })
                  })
                }}>Edit</button>
                <button className="btn-ghost-mini text-red" onClick={() => {
                  setDeleteConfig({ type: isTxn ? 'transaction' : 'invoice', id: item.source_id, title: `${item.type} for ${formatCurrency(item.amount)}` })
                }}>Delete</button>
              </div>
            </div>
          )
        })}
        {currentList.length === 0 && (
          <div className="empty-state-text">No {activeTab} found for this party.</div>
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
