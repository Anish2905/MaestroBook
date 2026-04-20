import { useState, useEffect } from 'react'
import { formatCurrency, getRelativeTime } from '../utils/format'
import { api } from '../api'

function getActivityDotColor(icon) {
  switch (icon) {
    case 'green': return '#10B981'
    case 'red': return '#f43f5e'
    case 'amber': return '#facc15'
    case 'blue': return '#3b82f6'
    case 'purple': return '#a855f7'
    default: return '#8a91ad'
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
    <div className="mobile-dashboard-container">
      {/* Hero Header */}
      <div className="dashboard-hero">
        <h1 className="greeting-text">Good morning, Maestro</h1>
        <p className="greeting-subtext">Here's your financial overview</p>
      </div>

      {/* Main Financial Summary Card (Luminous Ledger Style) */}
      <div className="premium-summary-card">
        <div className="summary-row">
          <div className="summary-col">
            <span className="summary-label">Total To Get</span>
            <span className="summary-value text-green">{formatCurrency(metrics.toGet)}</span>
          </div>
          <div className="summary-col right">
            <span className="summary-label">Total To Pay</span>
            <span className="summary-value text-red">{formatCurrency(metrics.toPay)}</span>
          </div>
        </div>
        <div className="summary-divider"></div>
        <div className="summary-center">
          <span className="summary-label">Net Balance</span>
          <span className="summary-value-large">{formatCurrency(metrics.netBalance)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons-row">
        <button className="btn-action-primary" onClick={() => openModal('invoice', {})}>
          + New Invoice
        </button>
        <button className="btn-action-secondary" onClick={() => openModal('receipt', {})}>
          + New Payment
        </button>
      </div>

      <div className="dashboard-lists-container">
        {/* Recent Activity */}
        <div className="activity-list-container">
          <div className="section-header">
            <h2 className="section-title">Recent Activity</h2>
            <span className="section-link" onClick={() => onNavigate('auditLog')}>View All</span>
          </div>
          <div className="activity-list">
            {recentActivity.map(item => (
              <div className="activity-row" key={item.log_id}>
                <div className="activity-dot-large" style={{ backgroundColor: getActivityDotColor(item.icon) }} />
                <div className="activity-content-flex">
                  <div className="activity-title">{item.description}</div>
                  <div className="activity-meta-flex">
                    <span className={`badge-minimal ${item.action_type}`}>{item.action_type}</span>
                    <span className="activity-time">{getRelativeTime(item.changed_at)}</span>
                  </div>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="empty-state-text">No recent activity.</div>
            )}
          </div>
        </div>

        {/* Top Outstanding */}
        <div className="outstanding-list-container">
          <div className="section-header">
            <h2 className="section-title">Top Outstanding</h2>
          </div>
          <div className="outstanding-list">
            {topOutstanding.map(party => {
              const balance = party.total_billed + party.opening_balance - party.total_received;
              return (
                <div className="outstanding-item" key={party.party_id} onClick={() => onNavigate('ledger')}>
                  <div className="outstanding-party-info">
                    <div className="outstanding-name">{party.party_name}</div>
                    <div className="outstanding-sub">{party.total_billed > 0 ? `${Math.round((balance / party.total_billed) * 100)}% pending` : 'Outstanding balance'}</div>
                  </div>
                  <div className="outstanding-amount text-green">
                    {formatCurrency(balance)}
                  </div>
                </div>
              );
            })}
            {topOutstanding.length === 0 && (
              <div className="empty-state-text">All accounts settled.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
