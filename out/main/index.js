"use strict";
const electron = require("electron");
const path = require("path");
const url = require("url");
const fs = require("fs");
const initSqlJs = require("sql.js");
const ExcelJS = require("exceljs");
const is = {
  dev: !electron.app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      electron.app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return electron.app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      electron.app.setLoginItemSettings({
        openAtLogin: auto,
        path: process.execPath
      });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return electron.session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    electron.ipcMain.on("win:invoke", (event, action) => {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
const __filename$1 = url.fileURLToPath(require("url").pathToFileURL(__filename).href);
const __dirname_main = path.join(__filename$1, "..");
let db = null;
let autoSaveInterval = null;
function getDbPath() {
  return path.join(electron.app.getPath("userData"), "maestro_books.db");
}
function getBackupDir() {
  const dir = path.join(electron.app.getPath("userData"), "backups");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
async function initDatabase() {
  const SQL = await initSqlJs();
  const p = getDbPath();
  if (fs.existsSync(p)) {
    db = new SQL.Database(fs.readFileSync(p));
  } else {
    db = new SQL.Database();
  }
  db.run("PRAGMA foreign_keys = ON");
  applySchema();
  saveDb();
}
function applySchema() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS parties (party_id INTEGER PRIMARY KEY AUTOINCREMENT, party_name TEXT NOT NULL, party_type TEXT CHECK(party_type IN ('Vendor','Customer','Both')) NOT NULL, phone TEXT, address TEXT, notes TEXT, opening_balance INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS invoices (invoice_id INTEGER PRIMARY KEY AUTOINCREMENT, party_id INTEGER NOT NULL REFERENCES parties(party_id), invoice_number TEXT, invoice_date TEXT NOT NULL, invoice_type TEXT CHECK(invoice_type IN ('Purchase','Sale')) NOT NULL, amount INTEGER NOT NULL, remarks TEXT, is_deleted INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS transactions (txn_id INTEGER PRIMARY KEY AUTOINCREMENT, txn_date TEXT NOT NULL, txn_type TEXT CHECK(txn_type IN ('Payment Made','Receipt')) NOT NULL, category TEXT NOT NULL, party_id INTEGER REFERENCES parties(party_id), linked_invoice_id INTEGER REFERENCES invoices(invoice_id), amount INTEGER NOT NULL, remarks TEXT, is_manual_override INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS balance_overrides (override_id INTEGER PRIMARY KEY AUTOINCREMENT, party_id INTEGER NOT NULL REFERENCES parties(party_id), override_amount INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS audit_log (log_id INTEGER PRIMARY KEY AUTOINCREMENT, action_type TEXT NOT NULL, table_affected TEXT NOT NULL, record_id INTEGER, old_value TEXT, new_value TEXT, remarks TEXT, changed_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('company_name', 'Maestro Engineering Works')`,
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('fy_start', 'April')`,
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('backup_retain_count', '30')`
  ];
  for (const s of stmts) {
    try {
      db.run(s);
    } catch (_) {
    }
  }
}
function saveDb() {
  if (!db) return;
  fs.writeFileSync(getDbPath(), Buffer.from(db.export()));
}
function startAutoSave() {
  autoSaveInterval = setInterval(saveDb, 5e3);
}
function stopAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}
function qAll(sql, params = []) {
  if (!db) return [];
  try {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  } catch (e) {
    console.error("qAll:", e.message, sql.slice(0, 60));
    return [];
  }
}
function qOne(sql, params = []) {
  return qAll(sql, params)[0] || null;
}
function run(sql, params = []) {
  if (!db) return { lastId: 0 };
  try {
    db.run(sql, params);
    const r = db.exec("SELECT last_insert_rowid()");
    return { lastId: r[0]?.values[0]?.[0] || 0 };
  } catch (e) {
    console.error("run:", e.message);
    throw e;
  }
}
function audit(action, table, id, oldV, newV, remarks) {
  try {
    run(
      `INSERT INTO audit_log (action_type,table_affected,record_id,old_value,new_value,remarks) VALUES (?,?,?,?,?,?)`,
      [action, table, id, oldV ? JSON.stringify(oldV) : null, newV ? JSON.stringify(newV) : null, remarks || null]
    );
  } catch (_) {
  }
}
function checkIntegrity() {
  if (!db) return { ok: false, message: "Not initialized" };
  try {
    const r = db.exec("PRAGMA integrity_check");
    const ok = r[0]?.values[0]?.[0] === "ok";
    return { ok, message: ok ? "ok" : String(r[0]?.values[0]?.[0]) };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}
function getDbInfo() {
  const p = getDbPath();
  let sizeKb = 0;
  try {
    sizeKb = Math.round(fs.statSync(p).size / 1024);
  } catch (_) {
  }
  const parties = qOne("SELECT COUNT(*) as c FROM parties WHERE is_deleted=0")?.c || 0;
  const invoices = qOne("SELECT COUNT(*) as c FROM invoices WHERE is_deleted=0")?.c || 0;
  const txns = qOne("SELECT COUNT(*) as c FROM transactions WHERE is_deleted=0")?.c || 0;
  return { sizeKb, sizeMb: (sizeKb / 1024).toFixed(2), totalRecords: parties + invoices + txns, integrityOk: checkIntegrity().ok, walMode: true };
}
function performBackup() {
  const p = getDbPath();
  if (!fs.existsSync(p)) return { success: false, error: "DB not found" };
  const dir = getBackupDir();
  const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = path.join(dir, `maestro_backup_${ts}.db`);
  fs.copyFileSync(p, dest);
  return { success: true, timestamp: (/* @__PURE__ */ new Date()).toISOString(), path: dest };
}
function pruneBackups(keep = 30) {
  const dir = getBackupDir();
  const files = fs.readdirSync(dir).filter((f) => f.startsWith("maestro_backup_") && f.endsWith(".db")).map((f) => ({ path: path.join(dir, f), time: fs.statSync(path.join(dir, f)).mtime.getTime() })).sort((a, b) => b.time - a.time);
  if (files.length > keep) files.slice(keep).forEach((f) => fs.unlinkSync(f.path));
}
function getLastBackupInfo() {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.startsWith("maestro_backup_") && f.endsWith(".db")).map((f) => ({ name: f, path: path.join(dir, f), time: fs.statSync(path.join(dir, f)).mtime })).sort((a, b) => b.time - a.time);
  if (!files.length) return null;
  return { success: true, timestamp: files[0].time.toISOString(), filename: files[0].name };
}
const HFILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1C2235" } };
const HFONT = { color: { argb: "FFF0A500" }, bold: true, size: 11 };
const EFILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F1117" } };
const OFILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1C2235" } };
const R2 = "₹#,##0.00";
const p2r = (p) => (p || 0) / 100;
function styleWs(ws) {
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const hr = ws.getRow(1);
  hr.eachCell((c) => {
    c.fill = HFILL;
    c.font = HFONT;
    c.alignment = { vertical: "middle" };
  });
  hr.height = 25;
  for (let i = 2; i <= ws.rowCount; i++) {
    ws.getRow(i).eachCell((c) => {
      c.fill = i % 2 === 0 ? EFILL : OFILL;
      c.font = { color: { argb: "FFE8EAF0" }, size: 10 };
    });
  }
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell({ includeEmpty: true }, (c) => {
      const l = c.value ? String(c.value).length : 0;
      if (l > max) max = l;
    });
    col.width = Math.min(max + 4, 40);
  });
}
async function saveWb(wb, name) {
  const win = electron.BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await electron.dialog.showSaveDialog(win || null, {
    title: "Save Export",
    defaultPath: name,
    filters: [{ name: "Excel", extensions: ["xlsx"] }]
  });
  if (canceled || !filePath) return { success: false, canceled: true };
  try {
    await wb.xlsx.writeFile(filePath);
    return { success: true, path: filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
function registerAllIpc() {
  electron.ipcMain.handle("dashboard:metrics", () => {
    const totalSales = qOne(`SELECT COALESCE(SUM(amount),0) as t FROM invoices WHERE invoice_type='Sale' AND is_deleted=0`)?.t || 0;
    const totalReceipts = qOne(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE txn_type='Receipt' AND is_deleted=0`)?.t || 0;
    const custOB = qOne(`SELECT COALESCE(SUM(opening_balance),0) as t FROM parties WHERE party_type IN ('Customer','Both') AND is_deleted=0`)?.t || 0;
    const toGet = totalSales - custOB - totalReceipts;
    const totalPurchases = qOne(`SELECT COALESCE(SUM(amount),0) as t FROM invoices WHERE invoice_type='Purchase' AND is_deleted=0`)?.t || 0;
    const totalPayments = qOne(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE txn_type='Payment Made' AND party_id IS NOT NULL AND linked_invoice_id IS NOT NULL AND is_deleted=0`)?.t || 0;
    const vendOB = qOne(`SELECT COALESCE(SUM(opening_balance),0) as t FROM parties WHERE party_type IN ('Vendor','Both') AND is_deleted=0`)?.t || 0;
    const toPay = totalPurchases + vendOB - totalPayments;
    const now = /* @__PURE__ */ new Date();
    const ms = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const thisMonthSales = qOne(`SELECT COALESCE(SUM(amount),0) as t FROM invoices WHERE invoice_type='Sale' AND is_deleted=0 AND invoice_date>=?`, [ms])?.t || 0;
    return { toGet, toPay, netBalance: toGet - toPay, thisMonthSales };
  });
  electron.ipcMain.handle("dashboard:recent-transactions", () => qAll(`SELECT t.*,p.party_name FROM transactions t LEFT JOIN parties p ON t.party_id=p.party_id WHERE t.is_deleted=0 ORDER BY t.txn_date DESC,t.txn_id DESC LIMIT 10`));
  electron.ipcMain.handle("dashboard:top-outstanding", () => qAll(`
    SELECT p.party_id,p.party_name,
      COALESCE(SUM(CASE WHEN i.invoice_type='Sale' THEN i.amount ELSE 0 END),0) as total_billed,
      COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id=p.party_id AND t.txn_type='Receipt' AND t.is_deleted=0),0) as total_received,
      p.opening_balance
    FROM parties p LEFT JOIN invoices i ON i.party_id=p.party_id AND i.is_deleted=0
    WHERE p.party_type IN ('Customer','Both') AND p.is_deleted=0
    GROUP BY p.party_id HAVING (total_billed-p.opening_balance-total_received)>0
    ORDER BY (total_billed-p.opening_balance-total_received) DESC LIMIT 5`));
  electron.ipcMain.handle("dashboard:recent-activity", () => {
    const logs = qAll(`SELECT * FROM audit_log ORDER BY changed_at DESC LIMIT 15`);
    return logs.map((log) => {
      let icon = "blue";
      let description = log.remarks || `${log.action_type} on ${log.table_affected}`;
      const newVal = log.new_value ? JSON.parse(log.new_value) : null;
      const oldVal = log.old_value ? JSON.parse(log.old_value) : null;
      if (log.table_affected === "parties") {
        icon = "amber";
        if (log.action_type === "INSERT") {
          description = `Added new party: ${newVal?.party_name || "—"} (${newVal?.party_type || "—"})`;
        } else if (log.action_type === "UPDATE") {
          description = `Updated party: ${newVal?.party_name || oldVal?.party_name || "—"}`;
        } else if (log.action_type === "DELETE") {
          description = `Deleted party: ${oldVal?.party_name || "—"}`;
        }
      } else if (log.table_affected === "invoices") {
        icon = "blue";
        if (log.action_type === "INSERT") {
          const amt = newVal?.amount ? `₹${(newVal.amount / 100).toFixed(2)}` : "";
          const party = qOne("SELECT party_name FROM parties WHERE party_id = ?", [newVal?.party_id]);
          description = `Created ${newVal?.invoice_type || ""} invoice ${newVal?.invoice_number || ""} for ${amt}${party ? " — " + party.party_name : ""}`;
        } else if (log.action_type === "UPDATE") {
          description = `Updated invoice ${newVal?.invoice_number || oldVal?.invoice_number || "#" + log.record_id}`;
        } else if (log.action_type === "DELETE") {
          description = `Deleted invoice ${oldVal?.invoice_number || "#" + log.record_id}`;
        }
      } else if (log.table_affected === "transactions") {
        if (log.action_type === "INSERT") {
          const amt = newVal?.amount ? `₹${(newVal.amount / 100).toFixed(2)}` : "";
          const party = newVal?.party_id ? qOne("SELECT party_name FROM parties WHERE party_id = ?", [newVal.party_id]) : null;
          if (newVal?.txn_type === "Receipt") {
            icon = "green";
            description = `Received ${amt}${party ? " from " + party.party_name : ""}`;
          } else {
            icon = "red";
            description = `Payment Made ${amt}${party ? " to " + party.party_name : ""} (${newVal?.category || "—"})`;
          }
        } else if (log.action_type === "UPDATE") {
          icon = "amber";
          description = `Updated transaction #${log.record_id}`;
        } else if (log.action_type === "DELETE") {
          icon = "red";
          const amt = oldVal?.amount ? `₹${(oldVal.amount / 100).toFixed(2)}` : "";
          description = `Deleted ${oldVal?.txn_type || "transaction"} of ${amt}`;
        }
      } else if (log.table_affected === "balance_overrides") {
        icon = "purple";
        const amt = newVal?.override_amount ? `₹${(Math.abs(newVal.override_amount) / 100).toFixed(2)}` : "";
        const party = newVal?.party_id ? qOne("SELECT party_name FROM parties WHERE party_id = ?", [newVal.party_id]) : null;
        description = `Balance override ${amt}${party ? " for " + party.party_name : ""} — ${newVal?.reason || "—"}`;
      } else if (log.table_affected === "settings") {
        icon = "blue";
        description = `Setting changed: ${newVal?.key || "—"} → "${newVal?.value || "—"}"`;
      }
      return {
        log_id: log.log_id,
        icon,
        description,
        changed_at: log.changed_at,
        action_type: log.action_type,
        table_affected: log.table_affected
      };
    });
  });
  const partySql = `SELECT p.*,
    COALESCE((SELECT SUM(i.amount) FROM invoices i WHERE i.party_id=p.party_id AND i.invoice_type='Sale' AND i.is_deleted=0),0) as total_sales,
    COALESCE((SELECT SUM(i.amount) FROM invoices i WHERE i.party_id=p.party_id AND i.invoice_type='Purchase' AND i.is_deleted=0),0) as total_purchases,
    COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id=p.party_id AND t.txn_type='Receipt' AND t.is_deleted=0),0) as total_receipts,
    COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id=p.party_id AND t.txn_type='Payment Made' AND t.is_deleted=0),0) as total_payments
    FROM parties p`;
  electron.ipcMain.handle("parties:list", () => qAll(`${partySql} WHERE p.is_deleted=0 ORDER BY p.party_name`));
  electron.ipcMain.handle("parties:get", (_, id) => qOne(`${partySql} WHERE p.party_id=? AND p.is_deleted=0`, [id]));
  electron.ipcMain.handle("parties:create", (_, d) => {
    const r = run(
      `INSERT INTO parties (party_name,party_type,phone,address,notes,opening_balance) VALUES (?,?,?,?,?,?)`,
      [d.party_name, d.party_type, d.phone || null, d.address || null, d.notes || null, d.opening_balance || 0]
    );
    audit("INSERT", "parties", r.lastId, null, d, `Created: ${d.party_name}`);
    saveDb();
    return r.lastId;
  });
  electron.ipcMain.handle("parties:update", (_, id, d) => {
    const old = qOne("SELECT * FROM parties WHERE party_id=?", [id]);
    run(
      `UPDATE parties SET party_name=?,party_type=?,phone=?,address=?,notes=?,opening_balance=?,updated_at=datetime('now') WHERE party_id=?`,
      [d.party_name, d.party_type, d.phone || null, d.address || null, d.notes || null, d.opening_balance || 0, id]
    );
    audit("UPDATE", "parties", id, old, d, `Updated: ${d.party_name}`);
    saveDb();
    return { success: true };
  });
  electron.ipcMain.handle("parties:delete", (_, id) => {
    const old = qOne("SELECT * FROM parties WHERE party_id=?", [id]);
    run(`UPDATE parties SET is_deleted=1,updated_at=datetime('now') WHERE party_id=?`, [id]);
    audit("DELETE", "parties", id, old, null, `Deleted: ${old?.party_name}`);
    saveDb();
    return { success: true };
  });
  electron.ipcMain.handle("invoices:list", (_, partyId) => {
    if (partyId) return qAll(`SELECT i.*,p.party_name FROM invoices i JOIN parties p ON i.party_id=p.party_id WHERE i.party_id=? AND i.is_deleted=0 ORDER BY i.invoice_date DESC`, [partyId]);
    return qAll(`SELECT i.*,p.party_name FROM invoices i JOIN parties p ON i.party_id=p.party_id WHERE i.is_deleted=0 ORDER BY i.invoice_date DESC`);
  });
  electron.ipcMain.handle("invoices:create", (_, d) => {
    const r = run(
      `INSERT INTO invoices (party_id,invoice_number,invoice_date,invoice_type,amount,remarks) VALUES (?,?,?,?,?,?)`,
      [d.party_id, d.invoice_number || null, d.invoice_date, d.invoice_type, d.amount, d.remarks || null]
    );
    audit("INSERT", "invoices", r.lastId, null, d, `Created ${d.invoice_type}: ${d.invoice_number || "N/A"}`);
    saveDb();
    return r.lastId;
  });
  electron.ipcMain.handle("invoices:update", (_, id, d) => {
    const old = qOne("SELECT * FROM invoices WHERE invoice_id=?", [id]);
    run(
      `UPDATE invoices SET party_id=?,invoice_number=?,invoice_date=?,invoice_type=?,amount=?,remarks=?,updated_at=datetime('now') WHERE invoice_id=?`,
      [d.party_id, d.invoice_number || null, d.invoice_date, d.invoice_type, d.amount, d.remarks || null, id]
    );
    audit("UPDATE", "invoices", id, old, d, `Updated: ${d.invoice_number}`);
    saveDb();
    return { success: true };
  });
  electron.ipcMain.handle("invoices:delete", (_, id) => {
    const old = qOne("SELECT * FROM invoices WHERE invoice_id=?", [id]);
    run(`UPDATE invoices SET is_deleted=1,updated_at=datetime('now') WHERE invoice_id=?`, [id]);
    audit("DELETE", "invoices", id, old, null, `Deleted invoice: ${old?.invoice_number || "#" + id}`);
    saveDb();
    return { success: true };
  });
  electron.ipcMain.handle("transactions:list", (_, f) => {
    let q = `SELECT t.*,p.party_name FROM transactions t LEFT JOIN parties p ON t.party_id=p.party_id WHERE t.is_deleted=0`;
    const params = [];
    if (f?.category) {
      q += " AND t.category=?";
      params.push(f.category);
    }
    if (f?.month) {
      q += " AND strftime('%Y-%m',t.txn_date)=?";
      params.push(f.month);
    }
    if (f?.type) {
      q += " AND t.txn_type=?";
      params.push(f.type);
    }
    q += " ORDER BY t.txn_date DESC,t.txn_id DESC";
    if (f?.limit) {
      q += " LIMIT ?";
      params.push(f.limit);
    }
    return qAll(q, params);
  });
  electron.ipcMain.handle("transactions:create", (_, d) => {
    const r = run(
      `INSERT INTO transactions (txn_date,txn_type,category,party_id,linked_invoice_id,amount,remarks,is_manual_override) VALUES (?,?,?,?,?,?,?,?)`,
      [d.txn_date, d.txn_type, d.category, d.party_id || null, d.linked_invoice_id || null, d.amount, d.remarks || null, d.is_manual_override || 0]
    );
    audit("INSERT", "transactions", r.lastId, null, d, `Created ${d.txn_type}`);
    saveDb();
    return r.lastId;
  });
  electron.ipcMain.handle("transactions:update", (_, id, d) => {
    const old = qOne("SELECT * FROM transactions WHERE txn_id=?", [id]);
    run(
      `UPDATE transactions SET txn_date=?,txn_type=?,category=?,party_id=?,linked_invoice_id=?,amount=?,remarks=?,updated_at=datetime('now') WHERE txn_id=?`,
      [d.txn_date, d.txn_type, d.category, d.party_id || null, d.linked_invoice_id || null, d.amount, d.remarks || null, id]
    );
    audit("UPDATE", "transactions", id, old, d, `Updated #${id}`);
    saveDb();
    return { success: true };
  });
  electron.ipcMain.handle("transactions:delete", (_, id) => {
    const old = qOne("SELECT * FROM transactions WHERE txn_id=?", [id]);
    run(`UPDATE transactions SET is_deleted=1,updated_at=datetime('now') WHERE txn_id=?`, [id]);
    audit("DELETE", "transactions", id, old, null, `Deleted #${id}`);
    saveDb();
    return { success: true };
  });
  electron.ipcMain.handle("balance:payable", () => qAll(`
    SELECT p.party_id,p.party_name,p.opening_balance,
      COALESCE(SUM(CASE WHEN i.invoice_type='Purchase' THEN i.amount ELSE 0 END),0) as total_invoiced,
      COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id=p.party_id AND t.txn_type='Payment Made' AND t.is_deleted=0 AND t.linked_invoice_id IS NOT NULL),0) as total_paid,
      COALESCE((SELECT SUM(bo.override_amount) FROM balance_overrides bo WHERE bo.party_id=p.party_id),0) as total_overrides
    FROM parties p LEFT JOIN invoices i ON i.party_id=p.party_id AND i.is_deleted=0
    WHERE p.party_type IN ('Vendor','Both') AND p.is_deleted=0 GROUP BY p.party_id
    HAVING (total_invoiced+p.opening_balance-total_paid-total_overrides)>0
    ORDER BY (total_invoiced+p.opening_balance-total_paid-total_overrides) DESC`));
  electron.ipcMain.handle("balance:receivable", () => qAll(`
    SELECT p.party_id,p.party_name,p.opening_balance,
      COALESCE(SUM(CASE WHEN i.invoice_type='Sale' THEN i.amount ELSE 0 END),0) as total_billed,
      COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id=p.party_id AND t.txn_type='Receipt' AND t.is_deleted=0),0) as total_received,
      COALESCE((SELECT SUM(bo.override_amount) FROM balance_overrides bo WHERE bo.party_id=p.party_id),0) as total_overrides
    FROM parties p LEFT JOIN invoices i ON i.party_id=p.party_id AND i.is_deleted=0
    WHERE p.party_type IN ('Customer','Both') AND p.is_deleted=0 GROUP BY p.party_id
    HAVING (total_billed-p.opening_balance-total_received-total_overrides)>0
    ORDER BY (total_billed-p.opening_balance-total_received-total_overrides) DESC`));
  electron.ipcMain.handle("balance:override", (_, d) => {
    const r = run(`INSERT INTO balance_overrides (party_id,override_amount,reason) VALUES (?,?,?)`, [d.party_id, d.override_amount, d.reason]);
    audit("OVERRIDE", "balance_overrides", r.lastId, null, d, `Override party#${d.party_id}`);
    saveDb();
    return r.lastId;
  });
  electron.ipcMain.handle("expenses:summary", (_, f) => {
    let w = "t.is_deleted=0";
    const p = [];
    if (f?.month) {
      w += " AND strftime('%Y-%m',t.txn_date)=?";
      p.push(f.month);
    }
    if (f?.category) {
      w += " AND t.category=?";
      p.push(f.category);
    }
    const out = qOne(`SELECT COALESCE(SUM(amount),0) as t FROM transactions t WHERE ${w} AND t.txn_type='Payment Made'`, p)?.t || 0;
    const inc = qOne(`SELECT COALESCE(SUM(amount),0) as t FROM transactions t WHERE ${w} AND t.txn_type='Receipt'`, p)?.t || 0;
    return { outgoing: out, incoming: inc, netCashFlow: inc - out };
  });
  electron.ipcMain.handle("expenses:categories", () => qAll(`SELECT DISTINCT category FROM transactions WHERE is_deleted=0 ORDER BY category`).map((r) => r.category));
  electron.ipcMain.handle("audit:list", () => qAll(`SELECT * FROM audit_log ORDER BY changed_at DESC LIMIT 250`));
  electron.ipcMain.handle("settings:get", () => {
    const rows = qAll("SELECT key,value FROM settings");
    const s = {};
    rows.forEach((r) => s[r.key] = r.value);
    return s;
  });
  electron.ipcMain.handle("settings:update", (_, key, value) => {
    run("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)", [key, value]);
    saveDb();
    return { success: true };
  });
  electron.ipcMain.handle("settings:db-info", () => getDbInfo());
  electron.ipcMain.handle("search:global", (_, q) => {
    const lq = `%${q}%`;
    return {
      parties: qAll(`SELECT party_id,party_name,party_type FROM parties WHERE is_deleted=0 AND party_name LIKE ? LIMIT 5`, [lq]),
      invoices: qAll(`SELECT i.invoice_id,i.invoice_number,i.invoice_type,p.party_name FROM invoices i JOIN parties p ON i.party_id=p.party_id WHERE i.is_deleted=0 AND (i.invoice_number LIKE ? OR p.party_name LIKE ?) LIMIT 5`, [lq, lq])
    };
  });
  electron.ipcMain.handle("party:all-transactions", (_, partyId) => {
    return qAll(`
      SELECT invoice_date as date, invoice_type as type,
        COALESCE(invoice_number, '#' || invoice_id) as description,
        amount, remarks, 'invoices' as source_table, invoice_id as source_id
      FROM invoices
      WHERE party_id = ? AND is_deleted = 0

      UNION ALL

      SELECT txn_date as date, txn_type as type,
        category as description,
        amount, remarks, 'transactions' as source_table, txn_id as source_id
      FROM transactions
      WHERE party_id = ? AND is_deleted = 0

      UNION ALL

      SELECT created_at as date, 'Override' as type,
        reason as description,
        override_amount as amount, reason as remarks,
        'balance_overrides' as source_table, override_id as source_id
      FROM balance_overrides
      WHERE party_id = ?

      ORDER BY date DESC
    `, [partyId, partyId, partyId]);
  });
  electron.ipcMain.handle("app:integrity-check", () => checkIntegrity());
  electron.ipcMain.handle("backup:info", () => getLastBackupInfo());
  electron.ipcMain.handle("backup:now", () => {
    try {
      saveDb();
      const r = performBackup();
      pruneBackups(30);
      return r;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("backup:browse", async (_, win) => {
    const mw = electron.BrowserWindow.getFocusedWindow();
    const r = await electron.dialog.showOpenDialog(mw || null, { title: "Select Backup", filters: [{ name: "SQLite DB", extensions: ["db"] }], properties: ["openFile"] });
    return r.canceled || !r.filePaths.length ? null : r.filePaths[0];
  });
  electron.ipcMain.handle("backup:restore", async (_, fp) => {
    try {
      saveDb();
      performBackup();
      fs.copyFileSync(fp, getDbPath());
      electron.app.relaunch();
      electron.app.exit(0);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("export:party-ledger", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Party Ledger");
    ws.columns = [{ header: "ID", key: "party_id" }, { header: "Name", key: "party_name" }, { header: "Type", key: "party_type" }, { header: "Phone", key: "phone" }, { header: "Address", key: "address" }, { header: "Opening Bal (₹)", key: "ob" }, { header: "Notes", key: "notes" }];
    qAll("SELECT * FROM parties WHERE is_deleted=0 ORDER BY party_name").forEach((p) => ws.addRow({ ...p, ob: p2r(p.opening_balance) }));
    ws.getColumn("ob").numFmt = R2;
    styleWs(ws);
    return saveWb(wb, "PartyLedger.xlsx");
  });
  electron.ipcMain.handle("export:invoice-register", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Invoice Register");
    ws.columns = [{ header: "ID", key: "invoice_id" }, { header: "Invoice No.", key: "invoice_number" }, { header: "Date", key: "invoice_date" }, { header: "Party", key: "party_name" }, { header: "Type", key: "invoice_type" }, { header: "Amount (₹)", key: "amt" }, { header: "Remarks", key: "remarks" }];
    qAll(`SELECT i.*,p.party_name FROM invoices i JOIN parties p ON i.party_id=p.party_id WHERE i.is_deleted=0 ORDER BY i.invoice_date DESC`).forEach((i) => ws.addRow({ ...i, amt: p2r(i.amount) }));
    ws.getColumn("amt").numFmt = R2;
    styleWs(ws);
    return saveWb(wb, "InvoiceRegister.xlsx");
  });
  electron.ipcMain.handle("export:transaction-log", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Transaction Log");
    ws.columns = [{ header: "ID", key: "txn_id" }, { header: "Date", key: "txn_date" }, { header: "Type", key: "txn_type" }, { header: "Category", key: "category" }, { header: "Party", key: "party_name" }, { header: "Amount (₹)", key: "amt" }, { header: "Remarks", key: "remarks" }];
    qAll(`SELECT t.*,p.party_name FROM transactions t LEFT JOIN parties p ON t.party_id=p.party_id WHERE t.is_deleted=0 ORDER BY t.txn_date DESC`).forEach((t) => ws.addRow({ ...t, amt: p2r(t.amount) }));
    ws.getColumn("amt").numFmt = R2;
    styleWs(ws);
    return saveWb(wb, "TransactionLog.xlsx");
  });
  electron.ipcMain.handle("export:outstanding-report", async () => {
    const wb = new ExcelJS.Workbook();
    const wsPay = wb.addWorksheet("To Pay");
    wsPay.columns = [{ header: "Vendor", key: "n" }, { header: "Total Invoiced (₹)", key: "ti" }, { header: "Total Paid (₹)", key: "tp" }, { header: "Balance (₹)", key: "b" }];
    qAll(`SELECT p.party_name,COALESCE(SUM(CASE WHEN i.invoice_type='Purchase' THEN i.amount ELSE 0 END),0) as ti,COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id=p.party_id AND t.txn_type='Payment Made' AND t.is_deleted=0 AND t.linked_invoice_id IS NOT NULL),0) as tp,p.opening_balance as ob FROM parties p LEFT JOIN invoices i ON i.party_id=p.party_id AND i.is_deleted=0 WHERE p.party_type IN ('Vendor','Both') AND p.is_deleted=0 GROUP BY p.party_id`).forEach((r) => wsPay.addRow({ n: r.party_name, ti: p2r(r.ti), tp: p2r(r.tp), b: p2r(r.ti + r.ob - r.tp) }));
    styleWs(wsPay);
    const wsGet = wb.addWorksheet("To Get");
    wsGet.columns = [{ header: "Customer", key: "n" }, { header: "Total Billed (₹)", key: "tb" }, { header: "Total Received (₹)", key: "tr" }, { header: "Balance (₹)", key: "b" }];
    qAll(`SELECT p.party_name,COALESCE(SUM(CASE WHEN i.invoice_type='Sale' THEN i.amount ELSE 0 END),0) as tb,COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id=p.party_id AND t.txn_type='Receipt' AND t.is_deleted=0),0) as tr,p.opening_balance as ob FROM parties p LEFT JOIN invoices i ON i.party_id=p.party_id AND i.is_deleted=0 WHERE p.party_type IN ('Customer','Both') AND p.is_deleted=0 GROUP BY p.party_id`).forEach((r) => wsGet.addRow({ n: r.party_name, tb: p2r(r.tb), tr: p2r(r.tr), b: p2r(r.tb - r.ob - r.tr) }));
    styleWs(wsGet);
    return saveWb(wb, "OutstandingReport.xlsx");
  });
  electron.ipcMain.handle("export:party-statement", async (_, partyId) => {
    const party = qOne("SELECT * FROM parties WHERE party_id=?", [partyId]);
    if (!party) return { success: false, error: "Not found" };
    const wb = new ExcelJS.Workbook();
    const wsI = wb.addWorksheet("Invoices");
    wsI.columns = [{ header: "Invoice No.", key: "invoice_number" }, { header: "Date", key: "invoice_date" }, { header: "Type", key: "invoice_type" }, { header: "Amount (₹)", key: "amt" }, { header: "Remarks", key: "remarks" }];
    qAll("SELECT * FROM invoices WHERE party_id=? AND is_deleted=0 ORDER BY invoice_date", [partyId]).forEach((i) => wsI.addRow({ ...i, amt: p2r(i.amount) }));
    wsI.getColumn("amt").numFmt = R2;
    styleWs(wsI);
    const wsT = wb.addWorksheet("Transactions");
    wsT.columns = [{ header: "Date", key: "txn_date" }, { header: "Type", key: "txn_type" }, { header: "Category", key: "category" }, { header: "Amount (₹)", key: "amt" }, { header: "Remarks", key: "remarks" }];
    qAll("SELECT * FROM transactions WHERE party_id=? AND is_deleted=0 ORDER BY txn_date", [partyId]).forEach((t) => wsT.addRow({ ...t, amt: p2r(t.amount) }));
    wsT.getColumn("amt").numFmt = R2;
    styleWs(wsT);
    return saveWb(wb, `Statement_${party.party_name.replace(/\s+/g, "_")}.xlsx`);
  });
  electron.ipcMain.handle("export:full-data", async () => {
    const wb = new ExcelJS.Workbook();
    const wsP = wb.addWorksheet("Parties");
    wsP.columns = [{ header: "ID", key: "party_id" }, { header: "Name", key: "party_name" }, { header: "Type", key: "party_type" }, { header: "Phone", key: "phone" }, { header: "Address", key: "address" }, { header: "Opening Bal (₹)", key: "ob" }];
    qAll("SELECT * FROM parties WHERE is_deleted=0").forEach((p) => wsP.addRow({ ...p, ob: p2r(p.opening_balance) }));
    styleWs(wsP);
    const wsI = wb.addWorksheet("Invoices");
    wsI.columns = [{ header: "ID", key: "invoice_id" }, { header: "Invoice No.", key: "invoice_number" }, { header: "Date", key: "invoice_date" }, { header: "Party", key: "party_name" }, { header: "Type", key: "invoice_type" }, { header: "Amount (₹)", key: "amt" }];
    qAll(`SELECT i.*,p.party_name FROM invoices i JOIN parties p ON i.party_id=p.party_id WHERE i.is_deleted=0`).forEach((i) => wsI.addRow({ ...i, amt: p2r(i.amount) }));
    styleWs(wsI);
    const wsT = wb.addWorksheet("Transactions");
    wsT.columns = [{ header: "ID", key: "txn_id" }, { header: "Date", key: "txn_date" }, { header: "Type", key: "txn_type" }, { header: "Category", key: "category" }, { header: "Party", key: "party_name" }, { header: "Amount (₹)", key: "amt" }];
    qAll(`SELECT t.*,p.party_name FROM transactions t LEFT JOIN parties p ON t.party_id=p.party_id WHERE t.is_deleted=0`).forEach((t) => wsT.addRow({ ...t, amt: p2r(t.amount) }));
    styleWs(wsT);
    const wsA = wb.addWorksheet("Audit Log");
    wsA.columns = [{ header: "ID", key: "log_id" }, { header: "Time", key: "changed_at" }, { header: "Action", key: "action_type" }, { header: "Table", key: "table_affected" }, { header: "Details", key: "remarks" }];
    qAll("SELECT * FROM audit_log ORDER BY changed_at DESC").forEach((l) => wsA.addRow(l));
    styleWs(wsA);
    return saveWb(wb, "FullDataExport.xlsx");
  });
}
let mainWindow = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: "#0f1117",
    webPreferences: {
      preload: path.join(__dirname_main, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.on("ready-to-show", () => mainWindow.show());
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname_main, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(async () => {
  electronApp.setAppUserModelId("com.maestro.engineering.books");
  electron.app.on("browser-window-created", (_, w) => optimizer.watchWindowShortcuts(w));
  await initDatabase();
  startAutoSave();
  let backupInfo = null;
  try {
    saveDb();
    backupInfo = performBackup();
    pruneBackups(30);
  } catch (e) {
    console.error("Backup failed:", e);
  }
  registerAllIpc();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  stopAutoSave();
  saveDb();
  if (process.platform !== "darwin") electron.app.quit();
});
