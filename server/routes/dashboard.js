import { Router } from 'express';
import { queryAll, queryOne } from '../db.js';

const router = Router();

// GET dashboard metrics
router.get('/metrics', async (req, res) => {
  try {
    const totalSalesRow = await queryOne(`SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE invoice_type='Sale' AND is_deleted=0`);
    const totalReceiptsRow = await queryOne(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE txn_type='Receipt' AND is_deleted=0`);
    const customerOpeningBalRow = await queryOne(`SELECT COALESCE(SUM(opening_balance), 0) as total FROM parties WHERE party_type IN ('Customer','Both') AND is_deleted=0`);
    
    // BUG FIX #4: customerOpeningBalRow should be added, not subtracted
    // customers with positive opening balance owe us money.
    const toGet = (totalSalesRow?.total || 0) + (customerOpeningBalRow?.total || 0) - (totalReceiptsRow?.total || 0);

    const totalPurchasesRow = await queryOne(`SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE invoice_type='Purchase' AND is_deleted=0`);
    
    // BUG FIX #5: Remove "linked_invoice_id IS NOT NULL" to properly account for all vendor payments
    const totalPaymentsRow = await queryOne(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE txn_type='Payment Made' AND party_id IS NOT NULL AND is_deleted=0`);
    const vendorOpeningBalRow = await queryOne(`SELECT COALESCE(SUM(opening_balance), 0) as total FROM parties WHERE party_type IN ('Vendor','Both') AND is_deleted=0`);
    
    const toPay = (totalPurchasesRow?.total || 0) + (vendorOpeningBalRow?.total || 0) - (totalPaymentsRow?.total || 0);

    const netBalance = toGet - toPay;

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const thisMonthSalesRow = await queryOne(`SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE invoice_type='Sale' AND is_deleted=0 AND invoice_date >= ?`, [monthStart]);
    const thisMonthSales = thisMonthSalesRow?.total || 0;

    res.json({ toGet, toPay, netBalance, thisMonthSales });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET recent activity (audit log parsed)
router.get('/recent-activity', async (req, res) => {
  try {
    const logs = await queryAll(`SELECT * FROM audit_log ORDER BY changed_at DESC LIMIT 15`);
    const activity = await Promise.all(logs.map(async log => {
      let icon = 'blue';
      let description = log.remarks || `${log.action_type} on ${log.table_affected}`;
      const newVal = log.new_value ? JSON.parse(log.new_value) : null;
      const oldVal = log.old_value ? JSON.parse(log.old_value) : null;

      if (log.table_affected === 'parties') {
        icon = 'amber';
        if (log.action_type === 'INSERT') {
          description = `Added new party: ${newVal?.party_name || '—'} (${newVal?.party_type || '—'})`;
        } else if (log.action_type === 'UPDATE') {
          description = `Updated party: ${newVal?.party_name || oldVal?.party_name || '—'}`;
        } else if (log.action_type === 'DELETE') {
          description = `Deleted party: ${oldVal?.party_name || '—'}`;
        }
      } else if (log.table_affected === 'invoices') {
        icon = 'blue';
        if (log.action_type === 'INSERT') {
          const amt = newVal?.amount ? `₹${(newVal.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '';
          let partyName = '';
          if (newVal?.party_id) {
             const party = await queryOne('SELECT party_name FROM parties WHERE party_id = ?', [newVal.party_id]);
             partyName = party ? ' — ' + party.party_name : '';
          }
          description = `Created ${newVal?.invoice_type || ''} invoice ${newVal?.invoice_number || ''} for ${amt}${partyName}`;
        } else if (log.action_type === 'UPDATE') {
          description = `Updated invoice ${newVal?.invoice_number || oldVal?.invoice_number || '#' + log.record_id}`;
        } else if (log.action_type === 'DELETE') {
          description = `Deleted invoice ${oldVal?.invoice_number || '#' + log.record_id}`;
        }
      } else if (log.table_affected === 'transactions') {
        if (log.action_type === 'INSERT') {
          const amt = newVal?.amount ? `₹${(newVal.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '';
          let partyName = '';
          if (newVal?.party_id) {
             const party = await queryOne('SELECT party_name FROM parties WHERE party_id = ?', [newVal.party_id]);
             partyName = party ? party.party_name : '';
          }
          if (newVal?.txn_type === 'Receipt') {
            icon = 'green';
            description = `Received ${amt}${partyName ? ' from ' + partyName : ''}`;
          } else {
            icon = 'red';
            description = `Payment Made ${amt}${partyName ? ' to ' + partyName : ''} (${newVal?.category || '—'})`;
          }
        } else if (log.action_type === 'UPDATE') {
          icon = 'amber';
          description = `Updated transaction #${log.record_id}`;
        } else if (log.action_type === 'DELETE') {
          icon = 'red';
          const amt = oldVal?.amount ? `₹${(oldVal.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '';
          description = `Deleted ${oldVal?.txn_type || 'transaction'} of ${amt}`;
        }
      } else if (log.table_affected === 'balance_overrides') {
        icon = 'purple';
        const amt = newVal?.override_amount ? `₹${(Math.abs(newVal.override_amount) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '';
        let partyName = '';
        if (newVal?.party_id) {
           const party = await queryOne('SELECT party_name FROM parties WHERE party_id = ?', [newVal.party_id]);
           partyName = party ? party.party_name : '';
        }
        description = `Balance override ${amt}${partyName ? ' for ' + partyName : ''} — ${newVal?.reason || '—'}`;
      } else if (log.table_affected === 'settings') {
        icon = 'blue';
        description = `Setting changed: ${newVal?.key || '—'} → "${newVal?.value || '—'}"`;
      }

      return {
        log_id: log.log_id,
        icon,
        description,
        changed_at: log.changed_at,
        action_type: log.action_type,
        table_affected: log.table_affected
      };
    }));
    
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET top outstanding
router.get('/top-outstanding', async (req, res) => {
  try {
    const outstanding = await queryAll(`
      SELECT p.party_id, p.party_name, p.opening_balance,
        COALESCE(SUM(CASE WHEN i.invoice_type='Sale' THEN i.amount ELSE 0 END), 0) as total_billed,
        COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id = p.party_id AND t.txn_type='Receipt' AND t.is_deleted=0), 0) as total_received
      FROM parties p LEFT JOIN invoices i ON i.party_id = p.party_id AND i.is_deleted = 0
      WHERE p.party_type IN ('Customer','Both') AND p.is_deleted = 0
      GROUP BY p.party_id
    `);

    // We do calculation in JS cause Libsql doesn't support complex HAVING with subqueries as easily in all versions without alias issues often, though it should work. Doing it in JS is safe.
    const top = outstanding
      .map(p => ({
        ...p,
        balance: p.total_billed + p.opening_balance - p.total_received
      }))
      .filter(p => p.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);

    res.json(top);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
