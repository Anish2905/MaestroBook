import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("TURSO_DATABASE_URL is missing in environment variables.");
}

export const db = createClient({
  url: url || 'libsql://dummy-url',
  authToken: authToken || 'dummy-token',
});

// Helper to run SELECT and return array of objects
export async function queryAll(sql, args = []) {
  try {
    const rs = await db.execute({ sql, args });
    return rs.rows;
  } catch (err) {
    console.error('Query error:', err.message, sql.substring(0, 80));
    return [];
  }
}

// Helper to run SELECT and return first row as object
export async function queryOne(sql, args = []) {
  const rows = await queryAll(sql, args);
  return rows.length > 0 ? rows[0] : null;
}

// Helper to run INSERT/UPDATE/DELETE
export async function runSql(sql, args = []) {
  try {
    const rs = await db.execute({ sql, args });
    return { changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid ? Number(rs.lastInsertRowid) : 0 };
  } catch (err) {
    console.error('Run error:', err.message, sql.substring(0, 80));
    throw err;
  }
}

// Audit helper
export async function audit(action, table, id, oldV, newV, remarks) {
  try {
    await runSql(
      `INSERT INTO audit_log (action_type, table_affected, record_id, old_value, new_value, remarks) VALUES (?, ?, ?, ?, ?, ?)`,
      [action, table, id, oldV ? JSON.stringify(oldV) : null, newV ? JSON.stringify(newV) : null, remarks || null]
    );
  } catch (e) {
    console.error('Audit error:', e.message);
  }
}

// Ensure schema is set up correctly in Turso
export async function initDatabase() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS parties (party_id INTEGER PRIMARY KEY AUTOINCREMENT, party_name TEXT NOT NULL, party_type TEXT CHECK(party_type IN ('Vendor','Customer','Both')) NOT NULL, phone TEXT, address TEXT, notes TEXT, opening_balance INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS invoices (invoice_id INTEGER PRIMARY KEY AUTOINCREMENT, party_id INTEGER NOT NULL REFERENCES parties(party_id), invoice_number TEXT, invoice_date TEXT NOT NULL, invoice_type TEXT CHECK(invoice_type IN ('Purchase','Sale')) NOT NULL, amount INTEGER NOT NULL, remarks TEXT, is_deleted INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS transactions (txn_id INTEGER PRIMARY KEY AUTOINCREMENT, txn_date TEXT NOT NULL, txn_type TEXT CHECK(txn_type IN ('Payment Made','Receipt')) NOT NULL, category TEXT NOT NULL, party_id INTEGER REFERENCES parties(party_id), linked_invoice_id INTEGER REFERENCES invoices(invoice_id), amount INTEGER NOT NULL, remarks TEXT, is_manual_override INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS balance_overrides (override_id INTEGER PRIMARY KEY AUTOINCREMENT, party_id INTEGER NOT NULL REFERENCES parties(party_id), override_amount INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS audit_log (log_id INTEGER PRIMARY KEY AUTOINCREMENT, action_type TEXT NOT NULL, table_affected TEXT NOT NULL, record_id INTEGER, old_value TEXT, new_value TEXT, remarks TEXT, changed_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('company_name', 'Maestro Engineering Works')`,
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('fy_start', 'April')`
  ];
  try {
    for (const stmt of stmts) {
      await db.execute(stmt);
    }
    console.log("Database schema applied successfully.");
  } catch (err) {
    console.error("Failed to initialize database schema:", err);
  }
}
