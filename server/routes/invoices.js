import { Router } from 'express';
import { queryAll, queryOne, runSql, audit } from '../db.js';

const router = Router();

// GET all invoices (optionally by partyId)
router.get('/', async (req, res) => {
  const { partyId } = req.query;
  try {
    if (partyId) {
      const invoices = await queryAll(`
        SELECT i.*, p.party_name FROM invoices i
        JOIN parties p ON i.party_id = p.party_id
        WHERE i.party_id = ? AND i.is_deleted = 0 ORDER BY i.invoice_date DESC
      `, [partyId]);
      res.json(invoices);
    } else {
      const invoices = await queryAll(`
        SELECT i.*, p.party_name FROM invoices i
        JOIN parties p ON i.party_id = p.party_id
        WHERE i.is_deleted = 0 ORDER BY i.invoice_date DESC
      `);
      res.json(invoices);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE invoice
router.post('/', async (req, res) => {
  const d = req.body;
  try {
    const r = await runSql(
      `INSERT INTO invoices (party_id, invoice_number, invoice_date, invoice_type, amount, remarks) VALUES (?, ?, ?, ?, ?, ?)`,
      [d.party_id, d.invoice_number || null, d.invoice_date, d.invoice_type, d.amount, d.remarks || null]
    );
    await audit('INSERT', 'invoices', r.lastInsertRowid, null, d, `Created ${d.invoice_type} invoice: ${d.invoice_number || 'N/A'}`);
    res.json({ id: r.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE invoice
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const d = req.body;
  try {
    const old = await queryOne('SELECT * FROM invoices WHERE invoice_id = ?', [id]);
    if (!old) return res.status(404).json({ error: 'Invoice not found' });

    await runSql(
      `UPDATE invoices SET party_id=?, invoice_number=?, invoice_date=?, invoice_type=?, amount=?, remarks=?, updated_at=datetime('now') WHERE invoice_id=?`,
      [d.party_id, d.invoice_number || null, d.invoice_date, d.invoice_type, d.amount, d.remarks || null, id]
    );
    await audit('UPDATE', 'invoices', id, old, d, `Updated invoice: ${d.invoice_number || 'N/A'}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE invoice
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const old = await queryOne('SELECT * FROM invoices WHERE invoice_id = ?', [id]);
    if (!old) return res.status(404).json({ error: 'Invoice not found' });

    await runSql(`UPDATE invoices SET is_deleted=1, updated_at=datetime('now') WHERE invoice_id=?`, [id]);
    await audit('DELETE', 'invoices', id, old, null, `Deleted invoice: ${old.invoice_number || '#' + id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
