import { Router } from 'express';
import { queryAll, queryOne, runSql, audit } from '../db.js';

const router = Router();

const partySql = `
  SELECT p.*,
    COALESCE((SELECT SUM(i.amount) FROM invoices i WHERE i.party_id=p.party_id AND i.invoice_type='Sale' AND i.is_deleted=0),0) as total_sales,
    COALESCE((SELECT SUM(i.amount) FROM invoices i WHERE i.party_id=p.party_id AND i.invoice_type='Purchase' AND i.is_deleted=0),0) as total_purchases,
    COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id=p.party_id AND t.txn_type='Receipt' AND t.is_deleted=0),0) as total_receipts,
    COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id=p.party_id AND t.txn_type='Payment Made' AND t.is_deleted=0),0) as total_payments
  FROM parties p
`;

// GET all parties
router.get('/', async (req, res) => {
  try {
    const parties = await queryAll(`${partySql} WHERE p.is_deleted=0 ORDER BY p.party_name`);
    res.json(parties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single party by ID
router.get('/:id', async (req, res) => {
  try {
    const party = await queryOne(`${partySql} WHERE p.party_id=? AND p.is_deleted=0`, [req.params.id]);
    if (!party) return res.status(404).json({ error: 'Party not found' });
    res.json(party);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE party
router.post('/', async (req, res) => {
  const d = req.body;
  try {
    const r = await runSql(
      `INSERT INTO parties (party_name, party_type, phone, address, notes, opening_balance) VALUES (?, ?, ?, ?, ?, ?)`,
      [d.party_name, d.party_type, d.phone || null, d.address || null, d.notes || null, d.opening_balance || 0]
    );
    await audit('INSERT', 'parties', r.lastInsertRowid, null, d, `Created: ${d.party_name}`);
    res.json({ id: r.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE party
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const d = req.body;
  try {
    const old = await queryOne('SELECT * FROM parties WHERE party_id=?', [id]);
    if (!old) return res.status(404).json({ error: 'Party not found' });

    await runSql(
      `UPDATE parties SET party_name=?, party_type=?, phone=?, address=?, notes=?, opening_balance=?, updated_at=datetime('now') WHERE party_id=?`,
      [d.party_name, d.party_type, d.phone || null, d.address || null, d.notes || null, d.opening_balance || 0, id]
    );
    await audit('UPDATE', 'parties', id, old, d, `Updated: ${d.party_name}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE party
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const old = await queryOne('SELECT * FROM parties WHERE party_id=?', [id]);
    if (!old) return res.status(404).json({ error: 'Party not found' });

    await runSql(`UPDATE parties SET is_deleted=1, updated_at=datetime('now') WHERE party_id=?`, [id]);
    await audit('DELETE', 'parties', id, old, null, `Deleted: ${old.party_name}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all transactions (timeline) for a single party
router.get('/:id/transactions', async (req, res) => {
  const { id } = req.params;
  try {
    const txns = await queryAll(`
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
    `, [id, id, id]);
    res.json(txns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
