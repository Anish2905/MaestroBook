import { useState, useEffect } from 'react'
import { formatCurrency, getRelativeTime, getFullDateTime } from '../utils/format'
import { api } from '../api'

function friendlyAction(actionType) {
  switch (actionType) {
    case 'INSERT': return 'Created'
    case 'UPDATE': return 'Updated'
    case 'DELETE': return 'Deleted'
    case 'OVERRIDE': return 'Adjusted'
    default: return actionType
  }
}

function friendlyTable(table) {
  switch (table) {
    case 'parties': return 'Party'
    case 'invoices': return 'Invoice'
    case 'transactions': return 'Transaction'
    case 'balance_overrides': return 'Balance Override'
    case 'settings': return 'Setting'
    default: return table
  }
}

function getActionBadge(action) {
  switch (action) {
    case 'INSERT': return 'badge-green'
    case 'UPDATE': return 'badge-amber'
    case 'DELETE': return 'badge-red'
    case 'OVERRIDE': return 'badge-purple'
    default: return 'badge-blue'
  }
}

function getActionIcon(action) {
  switch (action) {
    case 'INSERT': return '＋'
    case 'UPDATE': return '✎'
    case 'DELETE': return '✕'
    case 'OVERRIDE': return '⇅'
    default: return '●'
  }
}

function buildDescription(log) {
  const newVal = log.new_value ? JSON.parse(log.new_value) : null
  const oldVal = log.old_value ? JSON.parse(log.old_value) : null
  const table = log.table_affected
  const action = log.action_type

  if (table === 'parties') {
    const name = newVal?.party_name || oldVal?.party_name || '—'
    const ptype = newVal?.party_type || oldVal?.party_type || ''
    if (action === 'INSERT') return `Added new party "${name}" (${ptype})`
    if (action === 'UPDATE') return `Updated party "${name}"`
    if (action === 'DELETE') return `Deleted party "${name}"`
  }

  if (table === 'invoices') {
    const invNo = newVal?.invoice_number || oldVal?.invoice_number || `#${log.record_id}`
    const invType = newVal?.invoice_type || oldVal?.invoice_type || ''
    const amt = (newVal?.amount || oldVal?.amount)
    const amtStr = amt ? formatCurrency(amt) : ''
    if (action === 'INSERT') return `Created ${invType} invoice ${invNo} for ${amtStr}`
    if (action === 'UPDATE') return `Updated invoice ${invNo} (${invType} ${amtStr})`
    if (action === 'DELETE') return `Deleted invoice ${invNo} (${amtStr})`
  }

  if (table === 'transactions') {
    const txnType = newVal?.txn_type || oldVal?.txn_type || 'Transaction'
    const amt = (newVal?.amount || oldVal?.amount)
    const amtStr = amt ? formatCurrency(amt) : ''
    const cat = newVal?.category || oldVal?.category || ''
    if (action === 'INSERT') return `Recorded ${txnType} of ${amtStr}${cat ? ` (${cat})` : ''}`
    if (action === 'UPDATE') return `Updated ${txnType} #${log.record_id} — ${amtStr}`
    if (action === 'DELETE') return `Deleted ${txnType} of ${amtStr}`
  }

  if (table === 'balance_overrides') {
    const amt = newVal?.override_amount
    const amtStr = amt ? formatCurrency(Math.abs(amt)) : ''
    const reason = newVal?.reason || '—'
    return `Balance override of ${amtStr} — ${reason}`
  }

  if (table === 'settings') {
    return `Changed setting "${newVal?.key || '—'}" → "${newVal?.value || '—'}"`
  }

  return log.remarks || `${friendlyAction(action)} ${friendlyTable(table)} #${log.record_id || ''}`
}

function buildDiffItems(log) {
  const newVal = log.new_value ? JSON.parse(log.new_value) : null
  const oldVal = log.old_value ? JSON.parse(log.old_value) : null

  if (!newVal && !oldVal) return []

  // For INSERT, show all new values
  if (log.action_type === 'INSERT' && newVal) {
    return Object.entries(newVal).map(([key, val]) => ({
      field: key,
      oldVal: null,
      newVal: formatField(key, val)
    }))
  }

  // For DELETE, show all old values
  if (log.action_type === 'DELETE' && oldVal) {
    return Object.entries(oldVal)
      .filter(([key]) => !['is_deleted', 'created_at', 'updated_at'].includes(key))
      .map(([key, val]) => ({
        field: key,
        oldVal: formatField(key, val),
        newVal: null
      }))
  }

  // For UPDATE, show diff between old and new
  if (log.action_type === 'UPDATE' && oldVal && newVal) {
    const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)])
    return Array.from(allKeys)
      .filter(key => !['created_at', 'updated_at', 'is_deleted'].includes(key))
      .filter(key => JSON.stringify(oldVal[key]) !== JSON.stringify(newVal[key]))
      .map(key => ({
        field: key,
        oldVal: formatField(key, oldVal[key]),
        newVal: formatField(key, newVal[key])
      }))
  }

  // OVERRIDE
  if (newVal) {
    return Object.entries(newVal).map(([key, val]) => ({
      field: key,
      oldVal: null,
      newVal: formatField(key, val)
    }))
  }

  return []
}

function formatField(key, val) {
  if (val === null || val === undefined) return '—'
  if (['amount', 'opening_balance', 'override_amount'].includes(key)) {
    return formatCurrency(val)
  }
  return String(val)
}

const FILTER_ACTIONS = [
  { value: 'all', label: 'All' },
  { value: 'INSERT', label: 'Created' },
  { value: 'UPDATE', label: 'Updated' },
  { value: 'DELETE', label: 'Deleted' },
  { value: 'OVERRIDE', label: 'Overrides' }
]

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  useEffect(() => {
    api.getAuditList().then(setLogs).catch(err => console.error("Failed to load audit logs", err))
  }, [])

  const filteredLogs = logs.filter(log => {
    if (actionFilter !== 'all' && log.action_type !== actionFilter) return false
    if (search.trim()) {
      const desc = buildDescription(log).toLowerCase()
      const table = friendlyTable(log.table_affected).toLowerCase()
      const q = search.toLowerCase()
      if (!desc.includes(q) && !table.includes(q) && !(log.remarks || '').toLowerCase().includes(q)) {
        return false
      }
    }
    return true
  })

  return (
    <div className="card">
      <div className="card-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div className="flex items-center justify-between">
          <span className="card-title">Audit Log</span>
          <span className="text-muted" style={{ fontSize: 11 }}>{filteredLogs.length} of {logs.length} entries</span>
        </div>
        <div className="flex items-center gap-10" style={{ flexWrap: 'wrap' }}>
          <input
            className="form-input"
            placeholder="Search audit log…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 180, maxWidth: 300, padding: '7px 12px', fontSize: 12 }}
          />
          <div className="filter-pills" style={{ padding: 0, borderBottom: 'none' }}>
            {FILTER_ACTIONS.map(opt => (
              <button
                key={opt.value}
                className={`filter-pill ${actionFilter === opt.value ? 'active' : ''}`}
                onClick={() => setActionFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="card-body" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <div className="audit-list">
          {filteredLogs.map(log => {
            const isExpanded = expandedId === log.log_id
            const diffItems = isExpanded ? buildDiffItems(log) : []
            const desc = buildDescription(log)

            return (
              <div key={log.log_id} className={`audit-item ${isExpanded ? 'expanded' : ''}`}>
                <div
                  className="audit-item-main"
                  onClick={() => setExpandedId(isExpanded ? null : log.log_id)}
                >
                  <div className="audit-item-icon">
                    <span className={`audit-action-dot ${getActionBadge(log.action_type)}`}>
                      {getActionIcon(log.action_type)}
                    </span>
                  </div>
                  <div className="audit-item-body">
                    <div className="audit-item-desc">{desc}</div>
                    <div className="audit-item-meta">
                      <span className={`badge ${getActionBadge(log.action_type)}`} style={{ fontSize: 9, padding: '2px 6px' }}>
                        {friendlyAction(log.action_type)}
                      </span>
                      <span className="audit-item-table">{friendlyTable(log.table_affected)}</span>
                      {log.record_id && <span className="audit-item-id mono">#{log.record_id}</span>}
                    </div>
                  </div>
                  <div className="audit-item-time" title={getFullDateTime(log.changed_at)}>
                    {getRelativeTime(log.changed_at)}
                  </div>
                  <div className="audit-item-expand">
                    {isExpanded ? '▾' : '▸'}
                  </div>
                </div>

                {isExpanded && diffItems.length > 0 && (
                  <div className="audit-item-detail">
                    <table className="audit-diff-table">
                      <thead>
                        <tr>
                          <th>Field</th>
                          {log.action_type === 'UPDATE' ? (
                            <>
                              <th>Old Value</th>
                              <th>New Value</th>
                            </>
                          ) : log.action_type === 'DELETE' ? (
                            <th>Value (deleted)</th>
                          ) : (
                            <th>Value</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {diffItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="mono" style={{ color: 'var(--accent2)', fontSize: 11 }}>{item.field}</td>
                            {log.action_type === 'UPDATE' ? (
                              <>
                                <td className="text-red mono" style={{ fontSize: 11, textDecoration: 'line-through', opacity: 0.7 }}>
                                  {item.oldVal || '—'}
                                </td>
                                <td className="text-green mono" style={{ fontSize: 11 }}>
                                  {item.newVal || '—'}
                                </td>
                              </>
                            ) : log.action_type === 'DELETE' ? (
                              <td className="text-red mono" style={{ fontSize: 11 }}>{item.oldVal || '—'}</td>
                            ) : (
                              <td className="text-green mono" style={{ fontSize: 11 }}>{item.newVal || '—'}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {isExpanded && diffItems.length === 0 && (
                  <div className="audit-item-detail" style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 11 }}>
                    No detailed changes recorded for this entry.
                  </div>
                )}
              </div>
            )
          })}
          {filteredLogs.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontSize: 12 }}>
              {logs.length === 0 ? 'No audit log entries' : 'No entries match your search'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
