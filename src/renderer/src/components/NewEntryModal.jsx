import { useState, useEffect } from 'react'
import { rupeeToPaise, todayISO } from '../utils/format'
import { api } from '../api'

const ENTRY_TYPES = [
  { value: 'party', label: 'New Party' },
  { value: 'invoice', label: 'Invoice (Purchase / Sale)' },
  { value: 'expense', label: 'Expense / Payment Made' },
  { value: 'receipt', label: 'Receipt (Money Received)' }
]

export default function NewEntryModal({ onClose, onSaved, initialType, initialData }) {
  const [entryType, setEntryType] = useState(initialType || 'party')
  const [parties, setParties] = useState([])
  const [invoices, setInvoices] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    party_id: '',
    party_name: '',
    party_type: 'Customer',
    phone: '',
    address: '',
    notes: '',
    opening_balance: '',
    invoice_type: 'Sale',
    invoice_number: '',
    invoice_date: todayISO(),
    txn_date: todayISO(),
    txn_type: 'Payment Made',
    category: 'Material Purchase',
    linked_invoice_id: '',
    amount: '',
    remarks: ''
  })

  // Edit mode detection
  const isEditMode = !!(initialData && initialData.editId)
  const editId = initialData?.editId || null

  useEffect(() => {
    loadDropdowns()
  }, [])

  async function loadDropdowns() {
    try {
      const [p, i] = await Promise.all([
        api.getParties(),
        api.getInvoices()
      ])
      setParties(p)
      setInvoices(i)
    } catch (err) {
      console.error('Failed to load dropdown data:', err)
    }
  }

  useEffect(() => {
    if (initialData) {
      setForm(prev => ({ ...prev, ...initialData }))
    }
    if (initialType) setEntryType(initialType)
  }, [initialType, initialData])

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  async function handleSubmit() {
    setError('')
    try {
      if (entryType === 'party') {
        if (!form.party_name.trim()) {
          setError('Party name is required')
          return
        }
        const partyData = {
          party_name: form.party_name.trim(),
          party_type: form.party_type,
          phone: form.phone,
          address: form.address,
          notes: form.notes,
          opening_balance: rupeeToPaise(form.opening_balance)
        }
        if (isEditMode) {
          await api.updateParty(editId, partyData)
        } else {
          await api.createParty(partyData)
        }
      } else if (entryType === 'invoice') {
        if (!form.party_id) {
          setError('Please select a party')
          return
        }
        if (!form.amount || parseFloat(form.amount) <= 0) {
          setError('Please enter a valid amount')
          return
        }
        const invoiceData = {
          party_id: parseInt(form.party_id),
          invoice_number: form.invoice_number,
          invoice_date: form.invoice_date,
          invoice_type: form.invoice_type,
          amount: rupeeToPaise(form.amount),
          remarks: form.remarks
        }
        if (isEditMode) {
          await api.updateInvoice(editId, invoiceData)
        } else {
          await api.createInvoice(invoiceData)
        }
      } else if (entryType === 'expense') {
        if (!form.amount || parseFloat(form.amount) <= 0) {
          setError('Please enter a valid amount')
          return
        }
        const txnData = {
          txn_date: form.txn_date,
          txn_type: 'Payment Made',
          category: form.category,
          party_id: form.party_id ? parseInt(form.party_id) : null,
          linked_invoice_id: form.linked_invoice_id ? parseInt(form.linked_invoice_id) : null,
          amount: rupeeToPaise(form.amount),
          remarks: form.remarks
        }
        if (isEditMode) {
          await api.updateTransaction(editId, txnData)
        } else {
          await api.createTransaction(txnData)
        }
      } else if (entryType === 'receipt') {
        if (!form.party_id) {
          setError('Please select a party')
          return
        }
        if (!form.amount || parseFloat(form.amount) <= 0) {
          setError('Please enter a valid amount')
          return
        }
        const txnData = {
          txn_date: form.txn_date,
          txn_type: 'Receipt',
          category: 'Sales',
          party_id: parseInt(form.party_id),
          linked_invoice_id: form.linked_invoice_id ? parseInt(form.linked_invoice_id) : null,
          amount: rupeeToPaise(form.amount),
          remarks: form.remarks
        }
        if (isEditMode) {
          await api.updateTransaction(editId, txnData)
        } else {
          await api.createTransaction(txnData)
        }
      }
      onSaved()
    } catch (err) {
      setError('Save error: ' + (err.message || 'Unknown error'))
      console.error('Save error:', err)
    }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  // Filter invoices for the selected party
  const partyInvoices = invoices.filter(i =>
    !form.party_id || i.party_id === parseInt(form.party_id)
  )

  // Modal title based on edit mode
  function getModalTitle() {
    if (!isEditMode) return 'New Entry'
    switch (entryType) {
      case 'party': return 'Edit Party'
      case 'invoice': return 'Edit Invoice'
      case 'expense': return 'Edit Expense'
      case 'receipt': return 'Edit Receipt'
      default: return 'Edit Entry'
    }
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-box">
        <div className="modal-title">{getModalTitle()}</div>

        {error && (
          <div style={{ background: 'var(--red-dim)', color: 'var(--red)', padding: '8px 12px', borderRadius: 8, marginBottom: 14, fontSize: 12, fontWeight: 500 }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Entry Type</label>
          <select
            className="form-select"
            value={entryType}
            onChange={e => setEntryType(e.target.value)}
            disabled={isEditMode}
            style={isEditMode ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
          >
            {ENTRY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* New Party form */}
        {entryType === 'party' && (
          <>
            <div className="form-group">
              <label className="form-label">Party Name *</label>
              <input className="form-input" value={form.party_name} onChange={e => handleChange('party_name', e.target.value)} placeholder="Enter party name" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Party Type</label>
              <select className="form-select" value={form.party_type} onChange={e => handleChange('party_type', e.target.value)}>
                <option value="Customer">Customer</option>
                <option value="Vendor">Vendor</option>
                <option value="Both">Both</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input form-input-mono" value={form.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="Phone number" />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea className="form-textarea" value={form.address} onChange={e => handleChange('address', e.target.value)} placeholder="Address" />
            </div>
            <div className="form-group">
              <label className="form-label">Opening Balance (₹)</label>
              <input className="form-input form-input-mono" type="number" step="0.01" value={form.opening_balance} onChange={e => handleChange('opening_balance', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => handleChange('notes', e.target.value)} placeholder="Optional notes…" />
            </div>
          </>
        )}

        {/* Invoice form */}
        {entryType === 'invoice' && (
          <>
            <div className="form-group">
              <label className="form-label">Party Name *</label>
              {parties.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 12, padding: '8px 0' }}>No parties yet. Add a party first.</div>
              ) : (
                <select className="form-select" value={form.party_id} onChange={e => handleChange('party_id', e.target.value)}>
                  <option value="">Select party…</option>
                  {parties.map(p => <option key={p.party_id} value={p.party_id}>{p.party_name}</option>)}
                </select>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.invoice_type} onChange={e => handleChange('invoice_type', e.target.value)}>
                <option value="Purchase">Purchase</option>
                <option value="Sale">Sale</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Invoice Number (Optional)</label>
              <input className="form-input form-input-mono" value={form.invoice_number} onChange={e => handleChange('invoice_number', e.target.value)} placeholder="e.g. INV-001" />
            </div>
            <div className="form-group">
              <label className="form-label">Amount (₹) *</label>
              <input className="form-input form-input-mono" type="number" step="0.01" min="0" value={form.amount} onChange={e => handleChange('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input form-input-mono" type="date" value={form.invoice_date} onChange={e => handleChange('invoice_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Remarks</label>
              <textarea className="form-textarea" value={form.remarks} onChange={e => handleChange('remarks', e.target.value)} placeholder="Optional notes…" />
            </div>
          </>
        )}

        {/* Expense form */}
        {entryType === 'expense' && (
          <>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={e => handleChange('category', e.target.value)}>
                <option value="Material Purchase">Material Purchase</option>
                <option value="Salary">Salary</option>
                <option value="Electricity">Electricity</option>
                <option value="Transport">Transport</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Rent">Rent</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Party (Optional)</label>
              <select className="form-select" value={form.party_id} onChange={e => handleChange('party_id', e.target.value)}>
                <option value="">No party</option>
                {parties.map(p => <option key={p.party_id} value={p.party_id}>{p.party_name}</option>)}
              </select>
            </div>
            {form.party_id && (
              <div className="form-group">
                <label className="form-label">Linked Invoice (Optional)</label>
                <select className="form-select" value={form.linked_invoice_id} onChange={e => handleChange('linked_invoice_id', e.target.value)}>
                  <option value="">No linked invoice</option>
                  {partyInvoices.map(i => (
                    <option key={i.invoice_id} value={i.invoice_id}>{i.invoice_number || `#${i.invoice_id}`} — {i.party_name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Amount (₹) *</label>
              <input className="form-input form-input-mono" type="number" step="0.01" min="0" value={form.amount} onChange={e => handleChange('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input form-input-mono" type="date" value={form.txn_date} onChange={e => handleChange('txn_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Remarks</label>
              <textarea className="form-textarea" value={form.remarks} onChange={e => handleChange('remarks', e.target.value)} placeholder="Optional notes…" />
            </div>
          </>
        )}

        {/* Receipt form */}
        {entryType === 'receipt' && (
          <>
            <div className="form-group">
              <label className="form-label">Party Name *</label>
              {parties.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 12, padding: '8px 0' }}>No parties yet. Add a party first.</div>
              ) : (
                <select className="form-select" value={form.party_id} onChange={e => handleChange('party_id', e.target.value)}>
                  <option value="">Select party…</option>
                  {parties.map(p => <option key={p.party_id} value={p.party_id}>{p.party_name}</option>)}
                </select>
              )}
            </div>
            {form.party_id && (
              <div className="form-group">
                <label className="form-label">Linked Invoice (Optional)</label>
                <select className="form-select" value={form.linked_invoice_id} onChange={e => handleChange('linked_invoice_id', e.target.value)}>
                  <option value="">No linked invoice</option>
                  {partyInvoices.map(i => (
                    <option key={i.invoice_id} value={i.invoice_id}>{i.invoice_number || `#${i.invoice_id}`} — {i.party_name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Amount (₹) *</label>
              <input className="form-input form-input-mono" type="number" step="0.01" min="0" value={form.amount} onChange={e => handleChange('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input form-input-mono" type="date" value={form.txn_date} onChange={e => handleChange('txn_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Remarks</label>
              <textarea className="form-textarea" value={form.remarks} onChange={e => handleChange('remarks', e.target.value)} placeholder="Optional notes…" />
            </div>
          </>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-accent" onClick={handleSubmit}>
            {isEditMode ? 'Update Entry' : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}
