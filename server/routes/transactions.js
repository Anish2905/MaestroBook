import { Router } from 'express';
import { queryAll, queryOne, runSql, audit } from '../db.js';

const router = Router();

// GET all transactions with filters
router.get('/', async (req, res) => {
  const { category, month, type, limit } = req.query;
  try {
    let query = `SELECT t.*, p.party_name FROM transactions t LEFT JOIN parties p ON t.party_id = p.party_id WHERE t.is_deleted = 0`;
    const params = [];

    if (category) {
      query += ' AND t.category = ?';
      params.push(category);
    }
    if (month) {
      query += " AND strftime('%Y-%m', t.txn_date) = ?";
      params.push(month);
    }
    if (type) {
      query += ' AND t.txn_type = ?';
      params.push(type);
    }

    query += ' ORDER BY t.txn_date DESC, t.txn_id DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit, 10));
    }

    const txns = await queryAll(query, params);
    res.json(txns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await queryAll(`SELECT DISTINCT category FROM transactions WHERE is_deleted=0 ORDER BY category`);
    res.json(categories.map(r => r.category));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET summary
router.get('/summary', async (req, res) => {
  const { category, month } = req.query;
  try {
    let whereClause = 't.is_deleted = 0';
    const params = [];

    if (month) {
      whereClause += " AND strftime('%Y-%m', t.txn_date) = ?";
      params.push(month);
    }
    if (category) {
      whereClause += ' AND t.category = ?';
      params.push(category);
    }

    const outRow = await queryOne(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions t WHERE ${whereClause} AND t.txn_type='Payment Made'`, params);
    const incRow = await queryOne(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions t WHERE ${whereClause} AND t.txn_type='Receipt'`, params);
    
    const outgoing = outRow ? outRow.total : 0;
    const incoming = incRow ? incRow.total : 0;

    res.json({ outgoing, incoming, netCashFlow: incoming - outgoing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE transaction
router.post('/', async (req, res) => {
  const d = req.body;
  try {
    const r = await runSql(
      `INSERT INTO transactions (txn_date, txn_type, category, party_id, linked_invoice_id, amount, remarks, is_manual_override)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.txn_date, d.txn_type, d.category, d.party_id || null, d.linked_invoice_id || null, d.amount, d.remarks || null, d.is_manual_override || 0]
    );
    await audit('INSERT', 'transactions', r.lastInsertRowid, null, d, `Created ${d.txn_type}: ₹${(d.amount/100).toFixed(2)}`);
    res.json({ id: r.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE transaction
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const d = req.body;
  try {
    const old = await queryOne('SELECT * FROM transactions WHERE txn_id = ?', [id]);
    if (!old) return res.status(404).json({ error: 'Transaction not found' });

    await runSql(
      `UPDATE transactions SET txn_date=?, txn_type=?, category=?, party_id=?, linked_invoice_id=?, amount=?, remarks=?, updated_at=datetime('now') WHERE txn_id=?`,
      [d.txn_date, d.txn_type, d.category, d.party_id || null, d.linked_invoice_id || null, d.amount, d.remarks || null, id]
    );
    await audit('UPDATE', 'transactions', id, old, d, `Updated transaction #${id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE transaction
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const old = await queryOne('SELECT * FROM transactions WHERE txn_id = ?', [id]);
    if (!old) return res.status(404).json({ error: 'Transaction not found' });

    await runSql("UPDATE transactions SET is_deleted=1, updated_at=datetime('now') WHERE txn_id=?", [id]);
    await audit('DELETE', 'transactions', id, old, null, `Deleted transaction #${id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
