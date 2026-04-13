import { Router } from 'express';
import { queryAll, runSql, audit } from '../db.js';

const router = Router();

// GET payable balances (Who we owe money to)
router.get('/payable', async (req, res) => {
  try {
    const rows = await queryAll(`
      SELECT p.party_id, p.party_name, p.party_type, p.opening_balance,
        COALESCE((SELECT SUM(i.amount) FROM invoices i WHERE i.party_id=p.party_id AND i.invoice_type='Sale' AND i.is_deleted=0), 0) as sales,
        COALESCE((SELECT SUM(i.amount) FROM invoices i WHERE i.party_id=p.party_id AND i.invoice_type='Purchase' AND i.is_deleted=0), 0) as purchases,
        COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id=p.party_id AND t.txn_type='Receipt' AND t.is_deleted=0), 0) as receipts,
        COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id=p.party_id AND t.txn_type='Payment Made' AND t.is_deleted=0), 0) as payments,
        COALESCE((SELECT SUM(bo.override_amount) FROM balance_overrides bo WHERE bo.party_id = p.party_id), 0) as total_overrides
      FROM parties p WHERE p.is_deleted = 0
    `);
    
    const result = rows.map(r => {
      let bal = 0;
      if (r.party_type === 'Customer') {
        bal = r.opening_balance + r.sales - r.receipts - r.total_overrides;
      } else if (r.party_type === 'Vendor') {
        bal = -(r.opening_balance + r.purchases - r.payments + r.total_overrides);
      } else {
        bal = (r.opening_balance + r.sales - r.receipts) - (r.purchases - r.payments) - r.total_overrides;
      }
      return { ...r, net_balance: bal };
    })
    .filter(r => r.net_balance < 0) // We owe them money
    .map(r => ({
      ...r,
      total_invoiced: r.purchases,
      total_paid: r.payments,
      display_balance: Math.abs(r.net_balance)
    }))
    .sort((a, b) => b.display_balance - a.display_balance);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET receivable balances (Who owes us money)
router.get('/receivable', async (req, res) => {
  try {
    const rows = await queryAll(`
      SELECT p.party_id, p.party_name, p.party_type, p.opening_balance,
        COALESCE((SELECT SUM(i.amount) FROM invoices i WHERE i.party_id=p.party_id AND i.invoice_type='Sale' AND i.is_deleted=0), 0) as sales,
        COALESCE((SELECT SUM(i.amount) FROM invoices i WHERE i.party_id=p.party_id AND i.invoice_type='Purchase' AND i.is_deleted=0), 0) as purchases,
        COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id=p.party_id AND t.txn_type='Receipt' AND t.is_deleted=0), 0) as receipts,
        COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id=p.party_id AND t.txn_type='Payment Made' AND t.is_deleted=0), 0) as payments,
        COALESCE((SELECT SUM(bo.override_amount) FROM balance_overrides bo WHERE bo.party_id = p.party_id), 0) as total_overrides
      FROM parties p WHERE p.is_deleted = 0
    `);

    const result = rows.map(r => {
      let bal = 0;
      if (r.party_type === 'Customer') {
        bal = r.opening_balance + r.sales - r.receipts - r.total_overrides;
      } else if (r.party_type === 'Vendor') {
        bal = -(r.opening_balance + r.purchases - r.payments + r.total_overrides);
      } else {
        bal = (r.opening_balance + r.sales - r.receipts) - (r.purchases - r.payments) - r.total_overrides;
      }
      return { ...r, net_balance: bal };
    })
    .filter(r => r.net_balance > 0) // They owe us money
    .map(r => ({
      ...r,
      total_billed: r.sales,
      total_received: r.receipts,
      display_balance: r.net_balance
    }))
    .sort((a, b) => b.display_balance - a.display_balance);

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
