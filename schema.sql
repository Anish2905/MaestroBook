-- Maestro Engineering Works — Database Schema
-- All monetary amounts stored as integers in paise (₹1 = 100 paise)

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS parties (
  party_id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_name TEXT NOT NULL,
  party_type TEXT CHECK(party_type IN ('Vendor','Customer','Both')) NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  opening_balance INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id INTEGER NOT NULL REFERENCES parties(party_id),
  invoice_number TEXT,
  invoice_date TEXT NOT NULL,
  invoice_type TEXT CHECK(invoice_type IN ('Purchase','Sale')) NOT NULL,
  amount INTEGER NOT NULL,
  remarks TEXT,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  txn_id INTEGER PRIMARY KEY AUTOINCREMENT,
  txn_date TEXT NOT NULL,
  txn_type TEXT CHECK(txn_type IN ('Payment Made','Receipt')) NOT NULL,
  category TEXT NOT NULL,
  party_id INTEGER REFERENCES parties(party_id),
  linked_invoice_id INTEGER REFERENCES invoices(invoice_id),
  amount INTEGER NOT NULL,
  remarks TEXT,
  is_manual_override INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS balance_overrides (
  override_id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id INTEGER NOT NULL REFERENCES parties(party_id),
  override_amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_type TEXT NOT NULL,
  table_affected TEXT NOT NULL,
  record_id INTEGER,
  old_value TEXT,
  new_value TEXT,
  remarks TEXT,
  changed_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('company_name', 'Maestro Engineering Works');
INSERT OR IGNORE INTO settings (key, value) VALUES ('fy_start', 'April');
INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_retain_count', '30');
