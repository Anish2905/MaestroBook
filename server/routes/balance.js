import { Router } from 'express';
import { queryAll, runSql, audit } from '../db.js';

const router = Router();

// GET payable balances
router.get('/payable', async (req, res) => {
  try {
    const rows = await queryAll(`
      SELECT p.party_id, p.party_name, p.opening_balance,
        COALESCE(SUM(CASE WHEN i.invoice_type='Purchase' THEN i.amount ELSE 0 END), 0) as total_invoiced,
        COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id = p.party_id AND t.txn_type='Payment Made' AND t.is_deleted=0), 0) as total_paid,
        COALESCE((SELECT SUM(bo.override_amount) FROM balance_overrides bo WHERE bo.party_id = p.party_id), 0) as total_overrides
      FROM parties p LEFT JOIN invoices i ON i.party_id = p.party_id AND i.is_deleted = 0
      WHERE p.party_type IN ('Vendor','Both') AND p.is_deleted = 0
      GROUP BY p.party_id
    `);
    
    // Sort and filter in JS
    const result = rows.filter(r => {
      const bal = r.total_invoiced + r.opening_balance - r.total_paid - r.total_overrides;
      return bal > 0;
    }).sort((a, b) => {
      const balA = a.total_invoiced + a.opening_balance - a.total_paid - a.total_overrides;
      const balB = b.total_invoiced + b.opening_balance - b.total_paid - b.total_overrides;
      return balB - balA;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET receivable balances
router.get('/receivable', async (req, res) => {
  try {
    const rows = await queryAll(`
      SELECT p.party_id, p.party_name, p.opening_balance,
        COALESCE(SUM(CASE WHEN i.invoice_type='Sale' THEN i.amount ELSE 0 END), 0) as total_billed,
        COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id = p.party_id AND t.txn_type='Receipt' AND t.is_deleted=0), 0) as total_received,
        COALESCE((SELECT SUM(bo.override_amount) FROM balance_overrides bo WHERE bo.party_id = p.party_id), 0) as total_overrides
      FROM parties p LEFT JOIN invoices i ON i.party_id = p.party_id AND i.is_deleted = 0
      WHERE p.party_type IN ('Customer','Both') AND p.is_deleted = 0
      GROUP BY p.party_id
    `);

    // Sort and filter in JS
    const result = rows.filter(r => {
      const bal = r.total_billed + r.opening_balance - r.total_received - r.total_overrides;
      return bal > 0;
    }).sort((a, b) => {
      const balA = a.total_billed + a.opening_balance - a.total_received - a.total_overrides;
      const balB = b.total_billed + b.opening_balance - b.total_received - b.total_overrides;
      return balB - balA;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE override
router.post('/override', async (req, res) => {
  const d = req.body;
  try {
    const r = await runSql(
      `INSERT INTO balance_overrides (party_id, override_amount, reason) VALUES (?, ?, ?)`,
      [d.party_id, d.override_amount, d.reason]
    );
    await audit('OVERRIDE', 'balance_overrides', r.lastInsertRowid, null, d, `Manual override for party #${d.party_id}: ₹${(d.override_amount/100).toFixed(2)} — ${d.reason}`);
    res.json({ id: r.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
