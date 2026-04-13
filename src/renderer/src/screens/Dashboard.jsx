import { useState, useEffect } from 'react'
import { formatCurrency, formatDate, getTypeBadgeClass, getRelativeTime } from '../utils/format'
import logo from '../assets/logo.png'
import { api } from '../api'

function getActivityDotColor(icon) {
  switch (icon) {
    case 'green': return 'var(--green)'
    case 'red': return 'var(--red)'
    case 'amber': return 'var(--accent2)'
    case 'blue': return 'var(--blue)'
    case 'purple': return 'var(--purple)'
    default: return 'var(--muted)'
  }
}

export default function Dashboard({ openModal, onNavigate }) {
  const [metrics, setMetrics] = useState({ toGet: 0, toPay: 0, netBalance: 0, thisMonthSales: 0 })
  const [recentActivity, setRecentActivity] = useState([])
  const [topOutstanding, setTopOutstanding] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [m, activity, outstanding] = await Promise.all([
        api.getDashboardMetrics(),
        api.getRecentActivity(),
        api.getTopOutstanding()
      ])
      setMetrics(m)
      setRecentActivity(activity)
      setTopOutstanding(outstanding)
    } catch (err) {
      console.error('Dashboard load error:', err)
    }
  }

  return (
    <div className="dashboard-container">
      {/* Hero Section */}
      <div className="dashboard-hero">
        <div className="hero-content">
          <img src={logo} className="hero-logo" alt="Maestro Logo" />
          <div>
            <h1 className="hero-title">Maestro Engineering Works</h1>
            <p className="hero-subtitle">Professional Bookkeeping & Transaction Management</p>
          </div>
        </div>
        <div className="hero-actions">
          <button className="btn btn-accent" onClick={() => openModal('TXN_ENTRY')}>
            + Record Transaction
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid-4 mb-16">
        <div className="metric-card metric-card-green">
          <div className="metric-icon">↓</div>
          <div className="metric-label">Total To Get</div>
          <div className="metric-value metric-value-green">{formatCurrency(metrics.toGet)}</div>
          <div className="metric-sub">Amount receivable from customers</div>
        </div>
        <div className="metric-card metric-card-red">
          <div className="metric-icon">↑</div>
          <div className="metric-label">Total To Pay</div>
          <div className="metric-value metric-value-red">{formatCurrency(metrics.toPay)}</div>
          <div className="metric-sub">Amount payable to vendors</div>
        </div>
        <div className="metric-card metric-card-amber">
          <div className="metric-icon">⊘</div>
          <div className="metric-label">Net Balance</div>
          <div className="metric-value metric-value-amber">{formatCurrency(metrics.netBalance)}</div>
          <div className="metric-sub">Receivable minus payable</div>
        </div>
        <div className="metric-card metric-card-blue">
          <div className="metric-icon">◈</div>
          <div className="metric-label">This Month Sales</div>
          <div className="metric-value metric-value-blue">{formatCurrency(metrics.thisMonthSales)}</div>
          <div className="metric-sub">Sales invoices this month</div>
        </div>
      </div>

      {/* Two-column section */}
      <div className="grid-2-1">
        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Activity</span>
            <span className="card-link" onClick={() => onNavigate('auditLog')}>View all →</span>
          </div>
          <div className="card-body">
            <div className="activity-feed">
              {recentActivity.map(item => (
                <div className="activity-item" key={item.log_id}>
                  <div
                    className="activity-dot"
                    style={{ backgroundColor: getActivityDotColor(item.icon) }}
                  />
                  <div className="activity-content">
                    <div className="activity-desc">{item.description}</div>
                    <div className="activity-meta">
                      <span className={`badge ${
                        item.action_type === 'INSERT' ? 'badge-green' :
                        item.action_type === 'UPDATE' ? 'badge-amber' :
                        item.action_type === 'DELETE' ? 'badge-red' :
                        'badge-purple'
                      }`} style={{ fontSize: 9, padding: '2px 6px' }}>
                        {item.action_type === 'INSERT' ? 'Created' :
                         item.action_type === 'UPDATE' ? 'Updated' :
                         item.action_type === 'DELETE' ? 'Deleted' :
                         'Adjusted'}
                      </span>
                      <span className="activity-time" title={item.changed_at}>
                        {getRelativeTime(item.changed_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 24, fontSize: 12 }}>
                  No activity yet. Click "+ New Entry" to begin.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Outstanding */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Top Outstanding (To Get)</span>
          </div>
          <div className="card-body">
            {topOutstanding.map(party => {
              const balance = party.total_billed + party.opening_balance - party.total_received
              return (
                <div className="outstanding-row" key={party.party_id}>
                  <div>
                    <div className="outstanding-name">{party.party_name}</div>
                    <div className="outstanding-ref">Outstanding balance</div>
                  </div>
                  <div>
                    <div className="outstanding-amt text-green">{formatCurrency(balance)}</div>
                    <div className="outstanding-days">{party.total_billed > 0 ? `${Math.round((balance / party.total_billed) * 100)}% pending` : ''}</div>
                  </div>
                </div>
              )
            })}
            {topOutstanding.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 24, fontSize: 12 }}>No outstanding amounts</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
