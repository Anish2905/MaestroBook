/**
 * Format paise (integer) to Indian Rupee string
 * e.g., 1500000 → "₹15,000.00"
 */
export function formatCurrency(paise) {
  if (paise == null) return '₹0.00'
  const rupees = Math.abs(paise) / 100
  // Indian numbering format
  const formatted = rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  const sign = paise < 0 ? '−' : ''
  return `${sign}₹${formatted}`
}

/**
 * Format paise to short display (e.g., "₹1.5L")
 */
export function formatCurrencyShort(paise) {
  if (paise == null) return '₹0'
  const rupees = Math.abs(paise) / 100
  const sign = paise < 0 ? '−' : ''
  if (rupees >= 10000000) return `${sign}₹${(rupees / 10000000).toFixed(1)}Cr`
  if (rupees >= 100000) return `${sign}₹${(rupees / 100000).toFixed(1)}L`
  if (rupees >= 1000) return `${sign}₹${(rupees / 1000).toFixed(1)}K`
  return `${sign}₹${rupees.toFixed(0)}`
}

/**
 * Normalize SQLite datetime strings.
 * SQLite datetime('now') returns '2026-04-12 20:43:32' (space separator)
 * but JavaScript's Date constructor needs 'T' separator for reliable parsing.
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return null
  // Replace space between date and time with T for ISO format
  return dateStr.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/, '$1T$2')
}

/**
 * Format date string (YYYY-MM-DD or datetime) to DD-MM-YYYY
 */
export function formatDate(dateStr) {
  if (!dateStr) return '\u2014'
  // Extract just the date part — handle both space and T separators
  const dateOnly = dateStr.split(/[T\s]/)[0]
  const parts = dateOnly.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

/**
 * Format datetime to friendly string
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '\u2014'
  const d = new Date(normalizeDate(dateStr))
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Relative time from a date string
 */
export function getRelativeTime(dateStr) {
  if (!dateStr) return '\u2014'
  const d = new Date(normalizeDate(dateStr))
  if (isNaN(d.getTime())) return dateStr
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHrs < 24) return `${diffHrs} hr${diffHrs > 1 ? 's' : ''} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

/**
 * Full datetime string for tooltips
 */
export function getFullDateTime(dateStr) {
  if (!dateStr) return '\u2014'
  const d = new Date(normalizeDate(dateStr))
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function todayISO() {
  return new Date().toISOString().split('T')[0]
}

/**
 * Convert rupee input string to paise integer
 */
export function rupeeToPaise(rupeeStr) {
  const num = parseFloat(rupeeStr)
  if (isNaN(num)) return 0
  return Math.round(num * 100)
}

/**
 * Convert paise to rupee number (for displaying in inputs)
 */
export function paiseToRupee(paise) {
  if (paise == null) return ''
  return (paise / 100).toFixed(2)
}

/**
 * Days since a date
 */
export function daysSince(dateStr) {
  if (!dateStr) return 0
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * Get transaction type badge class
 */
export function getTypeBadgeClass(type) {
  switch (type) {
    case 'Payment Made': return 'badge-red'
    case 'Receipt': return 'badge-green'
    case 'Expense':
    case 'Salary': return 'badge-amber'
    case 'Purchase': return 'badge-blue'
    case 'Sale': return 'badge-blue'
    case 'Manual Override': return 'badge-purple'
    default: return 'badge-amber'
  }
}

/**
 * Get invoice status
 */
export function getInvoiceStatus(invoice, payments) {
  const totalPaid = payments || 0
  if (totalPaid >= invoice.amount) return 'Cleared'
  if (totalPaid > 0) return 'Partial'
  return 'Pending'
}

/**
 * Get current month as YYYY-MM
 */
export function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
