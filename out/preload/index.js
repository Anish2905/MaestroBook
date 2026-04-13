"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("api", {
  // Dashboard
  getDashboardMetrics: () => ipcRenderer.invoke("dashboard:metrics"),
  getRecentTransactions: () => ipcRenderer.invoke("dashboard:recent-transactions"),
  getTopOutstanding: () => ipcRenderer.invoke("dashboard:top-outstanding"),
  getRecentActivity: () => ipcRenderer.invoke("dashboard:recent-activity"),
  // Parties
  getParties: () => ipcRenderer.invoke("parties:list"),
  getParty: (id) => ipcRenderer.invoke("parties:get", id),
  createParty: (data) => ipcRenderer.invoke("parties:create", data),
  updateParty: (id, data) => ipcRenderer.invoke("parties:update", id, data),
  deleteParty: (id) => ipcRenderer.invoke("parties:delete", id),
  getPartyAllTransactions: (partyId) => ipcRenderer.invoke("party:all-transactions", partyId),
  // Invoices
  getInvoices: (partyId) => ipcRenderer.invoke("invoices:list", partyId),
  createInvoice: (data) => ipcRenderer.invoke("invoices:create", data),
  updateInvoice: (id, data) => ipcRenderer.invoke("invoices:update", id, data),
  deleteInvoice: (id) => ipcRenderer.invoke("invoices:delete", id),
  // Transactions
  getTransactions: (filters) => ipcRenderer.invoke("transactions:list", filters),
  createTransaction: (data) => ipcRenderer.invoke("transactions:create", data),
  updateTransaction: (id, data) => ipcRenderer.invoke("transactions:update", id, data),
  deleteTransaction: (id) => ipcRenderer.invoke("transactions:delete", id),
  // Balance
  getPayable: () => ipcRenderer.invoke("balance:payable"),
  getReceivable: () => ipcRenderer.invoke("balance:receivable"),
  createOverride: (data) => ipcRenderer.invoke("balance:override", data),
  // Expenses
  getExpensesSummary: (filters) => ipcRenderer.invoke("expenses:summary", filters),
  getCategories: () => ipcRenderer.invoke("expenses:categories"),
  // Audit Log
  getAuditLog: () => ipcRenderer.invoke("audit:list"),
  // Settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSetting: (key, value) => ipcRenderer.invoke("settings:update", key, value),
  getDbInfo: () => ipcRenderer.invoke("settings:db-info"),
  // App
  checkIntegrity: () => ipcRenderer.invoke("app:integrity-check"),
  // Backup
  getBackupInfo: () => ipcRenderer.invoke("backup:info"),
  backupNow: () => ipcRenderer.invoke("backup:now"),
  browseBackup: () => ipcRenderer.invoke("backup:browse"),
  restoreBackup: (filePath) => ipcRenderer.invoke("backup:restore", filePath),
  // Export
  exportPartyLedger: () => ipcRenderer.invoke("export:party-ledger"),
  exportInvoiceRegister: () => ipcRenderer.invoke("export:invoice-register"),
  exportTransactionLog: () => ipcRenderer.invoke("export:transaction-log"),
  exportOutstandingReport: () => ipcRenderer.invoke("export:outstanding-report"),
  exportPartyStatement: (partyId) => ipcRenderer.invoke("export:party-statement", partyId),
  exportFullData: () => ipcRenderer.invoke("export:full-data"),
  // Search
  globalSearch: (query) => ipcRenderer.invoke("search:global", query)
});
