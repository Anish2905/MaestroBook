import { fetchWithCache, queueMutation } from './utils/syncManager';

const API_BASE = '/api';

async function fetchJSON(url, options = {}) {
  const method = options.method || 'GET';
  
  if (method === 'GET') {
    return fetchWithCache(url, async () => {
      const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || response.statusText);
      }
      return response.json();
    });
  } else {
    // It's a mutation (POST, PUT, DELETE)
    try {
      if (!navigator.onLine) {
        throw new Error('Offline');
      }
      const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || response.statusText);
      }
      return response.json();
    } catch (err) {
      // If offline or network failure, queue the mutation
      if (!navigator.onLine || err.message === 'Failed to fetch' || err.message === 'Offline') {
        const bodyObj = options.body ? JSON.parse(options.body) : null;
        await queueMutation(url, method, bodyObj);
        return { success: true, offlineQueued: true };
      }
      throw err;
    }
  }
}

// Attempt to sync immediately on startup
import { syncQueue } from './utils/syncManager';
setTimeout(() => syncQueue(API_BASE), 1000);

export const api = {
  // Parties
  getParties: () => fetchJSON('/parties'),
  getParty: (id) => fetchJSON(`/parties/${id}`),
  createParty: (data) => fetchJSON('/parties', { method: 'POST', body: JSON.stringify(data) }),
  updateParty: (id, data) => fetchJSON(`/parties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteParty: (id, data) => fetchJSON(`/parties/${id}`, { method: 'DELETE', body: JSON.stringify(data) }),
  getPartyTransactions: (id) => fetchJSON(`/parties/${id}/transactions`),

  // Invoices
  getInvoices: (partyId) => fetchJSON(partyId ? `/invoices?partyId=${partyId}` : '/invoices'),
  createInvoice: (data) => fetchJSON('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  updateInvoice: (id, data) => fetchJSON(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteInvoice: (id, data) => fetchJSON(`/invoices/${id}`, { method: 'DELETE', body: JSON.stringify(data) }),

  // Transactions
  getTransactions: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchJSON(`/transactions?${params}`);
  },
  getExpensesSummary: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return fetchJSON(`/transactions/summary?${params}`);
  },
  getExpenseCategories: () => fetchJSON('/transactions/categories'),
  createTransaction: (data) => fetchJSON('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id, data) => fetchJSON(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransaction: (id, data) => fetchJSON(`/transactions/${id}`, { method: 'DELETE', body: JSON.stringify(data) }),

  // Balance
  getPayables: () => fetchJSON('/balance/payable'),
  getReceivables: () => fetchJSON('/balance/receivable'),
  createOverride: (data) => fetchJSON('/balance/override', { method: 'POST', body: JSON.stringify(data) }),

  // Dashboard
  getDashboardMetrics: () => fetchJSON('/dashboard/metrics'),
  getRecentActivity: () => fetchJSON('/dashboard/recent-activity'),
  getTopOutstanding: () => fetchJSON('/dashboard/top-outstanding'),

  // Audit
  getAuditList: () => fetchJSON('/audit'),

  // Settings
  getSettings: () => fetchJSON('/settings'),
  updateSetting: (key, value) => fetchJSON('/settings', { method: 'PUT', body: JSON.stringify({ key, value }) }),
  getDbInfo: () => fetchJSON('/settings/db-info'),

  // Search
  searchGlobal: (query) => fetchJSON(`/search?q=${encodeURIComponent(query)}`),

  // App/Misc (removed IPC reliance)
  checkIntegrity: async () => ({ ok: true, message: 'Cloud DB integrity managed remotely' }),
  getBackupInfo: async () => null,
  doBackup: async () => { throw new Error('Backups are managed by Turso Cloud') },
  browseBackupFile: async () => null,
  restoreBackup: async () => { throw new Error('Not supported in web version') },
};
