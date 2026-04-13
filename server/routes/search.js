import { Router } from 'express';
import { queryAll } from '../db.js';

const router = Router();

// GET global search results
router.get('/', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ parties: [], invoices: [] });
  
  const lq = `%${q}%`;
  try {
    const parties = await queryAll(
      `SELECT party_id, party_name, party_type FROM parties WHERE is_deleted=0 AND party_name LIKE ? LIMIT 5`,
      [lq]
    );
    const invoices = await queryAll(
      `SELECT i.invoice_id, i.invoice_number, i.invoice_type, p.party_name FROM invoices i JOIN parties p ON i.party_id=p.party_id WHERE i.is_deleted=0 AND (i.invoice_number LIKE ? OR p.party_name LIKE ?) LIMIT 5`,
      [lq, lq]
    );

    res.json({ parties, invoices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
