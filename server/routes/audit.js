import { Router } from 'express';
import { queryAll } from '../db.js';

const router = Router();

// GET all audit logs
router.get('/', async (req, res) => {
  try {
    const logs = await queryAll(`SELECT * FROM audit_log ORDER BY changed_at DESC LIMIT 250`);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
