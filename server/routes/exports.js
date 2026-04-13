import { Router } from 'express';
import ExcelJS from 'exceljs';
import { queryAll, queryOne } from '../db.js';

const router = Router();

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C2235' } };
const HEADER_FONT = { color: { argb: 'FFF0A500' }, bold: true, size: 11 };
const EVEN_ROW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1117' } };
const ODD_ROW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C2235' } };
const RUPEE_FORMAT = '₹#,##0.00';

function styleWorksheet(worksheet) {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  const headerRow = worksheet.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  headerRow.height = 25;

  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    row.eachCell(cell => {
      cell.fill = i % 2 === 0 ? EVEN_ROW_FILL : ODD_ROW_FILL;
      cell.font = { color: { argb: 'FFE8EAF0' }, size: 10 };
    });
  }

  worksheet.columns.forEach(col => {
    let maxLen = 10;
    col.eachCell({ includeEmpty: true }, cell => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 4, 40);
  });
}

function paiseTo(paise) { return (paise || 0) / 100; }

async function sendWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

// 1. Party Ledger
router.get('/party-ledger', async (req, res) => {
  try {
    const parties = await queryAll('SELECT * FROM parties WHERE is_deleted=0 ORDER BY party_name');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Party Ledger');
    ws.columns = [
      { header: 'Party ID', key: 'party_id' },
      { header: 'Party Name', key: 'party_name' },
      { header: 'Type', key: 'party_type' },
      { header: 'Phone', key: 'phone' },
      { header: 'Address', key: 'address' },
      { header: 'Opening Balance (₹)', key: 'opening_balance' },
      { header: 'Notes', key: 'notes' }
    ];
    parties.forEach(p => ws.addRow({ ...p, opening_balance: paiseTo(p.opening_balance) }));
    ws.getColumn('opening_balance').numFmt = RUPEE_FORMAT;
    styleWorksheet(ws);
    await sendWorkbook(res, workbook, 'PartyLedger.xlsx');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 2. Invoice Register
router.get('/invoice-register', async (req, res) => {
  try {
    const invoices = await queryAll(`SELECT i.*, p.party_name FROM invoices i JOIN parties p ON i.party_id = p.party_id WHERE i.is_deleted=0 ORDER BY i.invoice_date DESC`);
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Invoice Register');
    ws.columns = [
      { header: 'Invoice ID', key: 'invoice_id' },
      { header: 'Invoice No.', key: 'invoice_number' },
      { header: 'Date', key: 'invoice_date' },
      { header: 'Party', key: 'party_name' },
      { header: 'Type', key: 'invoice_type' },
      { header: 'Amount (₹)', key: 'amount' },
      { header: 'Remarks', key: 'remarks' }
    ];
    invoices.forEach(inv => ws.addRow({ ...inv, amount: paiseTo(inv.amount) }));
    ws.getColumn('amount').numFmt = RUPEE_FORMAT;
    styleWorksheet(ws);
    await sendWorkbook(res, workbook, 'InvoiceRegister.xlsx');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 3. Transaction Log
router.get('/transaction-log', async (req, res) => {
  try {
    const txns = await queryAll(`SELECT t.*, p.party_name FROM transactions t LEFT JOIN parties p ON t.party_id = p.party_id WHERE t.is_deleted=0 ORDER BY t.txn_date DESC`);
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Transaction Log');
    ws.columns = [
      { header: 'Txn ID', key: 'txn_id' },
      { header: 'Date', key: 'txn_date' },
      { header: 'Type', key: 'txn_type' },
      { header: 'Category', key: 'category' },
      { header: 'Party', key: 'party_name' },
      { header: 'Amount (₹)', key: 'amount' },
      { header: 'Remarks', key: 'remarks' }
    ];
    txns.forEach(t => ws.addRow({ ...t, amount: paiseTo(t.amount) }));
    ws.getColumn('amount').numFmt = RUPEE_FORMAT;
    styleWorksheet(ws);
    await sendWorkbook(res, workbook, 'TransactionLog.xlsx');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 4. Outstanding Report
router.get('/outstanding-report', async (req, res) => {
  try {
    const payable = await queryAll(`
      SELECT p.party_name,
        COALESCE(SUM(CASE WHEN i.invoice_type='Purchase' THEN i.amount ELSE 0 END), 0) as total_invoiced,
        COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id = p.party_id AND t.txn_type='Payment Made' AND t.is_deleted=0 AND t.linked_invoice_id IS NOT NULL), 0) as total_paid,
        p.opening_balance
      FROM parties p LEFT JOIN invoices i ON i.party_id = p.party_id AND i.is_deleted=0
      WHERE p.party_type IN ('Vendor','Both') AND p.is_deleted=0 GROUP BY p.party_id
    `);
    const receivable = await queryAll(`
      SELECT p.party_name,
        COALESCE(SUM(CASE WHEN i.invoice_type='Sale' THEN i.amount ELSE 0 END), 0) as total_billed,
        COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.party_id = p.party_id AND t.txn_type='Receipt' AND t.is_deleted=0), 0) as total_received,
        p.opening_balance
      FROM parties p LEFT JOIN invoices i ON i.party_id = p.party_id AND i.is_deleted=0
      WHERE p.party_type IN ('Customer','Both') AND p.is_deleted=0 GROUP BY p.party_id
    `);

    const workbook = new ExcelJS.Workbook();
    const wsPay = workbook.addWorksheet('To Pay (Payable)');
    wsPay.columns = [
      { header: 'Vendor', key: 'party_name' },
      { header: 'Total Invoiced (₹)', key: 'total_invoiced' },
      { header: 'Total Paid (₹)', key: 'total_paid' },
      { header: 'Opening Bal (₹)', key: 'opening_balance' },
      { header: 'Balance (₹)', key: 'balance' }
    ];
    payable.forEach(r => {
      wsPay.addRow({ ...r, total_invoiced: paiseTo(r.total_invoiced), total_paid: paiseTo(r.total_paid), opening_balance: paiseTo(r.opening_balance), balance: paiseTo(r.total_invoiced + r.opening_balance - r.total_paid) });
    });
    styleWorksheet(wsPay);

    const wsGet = workbook.addWorksheet('To Get (Receivable)');
    wsGet.columns = [
      { header: 'Customer', key: 'party_name' },
      { header: 'Total Billed (₹)', key: 'total_billed' },
      { header: 'Total Received (₹)', key: 'total_received' },
      { header: 'Opening Bal (₹)', key: 'opening_balance' },
      { header: 'Balance (₹)', key: 'balance' }
    ];
    receivable.forEach(r => {
      wsGet.addRow({ ...r, total_billed: paiseTo(r.total_billed), total_received: paiseTo(r.total_received), opening_balance: paiseTo(r.opening_balance), balance: paiseTo(r.total_billed + r.opening_balance - r.total_received) });
    });
    styleWorksheet(wsGet);
    await sendWorkbook(res, workbook, 'OutstandingReport.xlsx');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 5. Party Statement
router.get('/party-statement/:id', async (req, res) => {
  const partyId = req.params.id;
  try {
    const party = await queryOne('SELECT * FROM parties WHERE party_id=?', [partyId]);
    if (!party) return res.status(404).send('Party not found');

    const invoices = await queryAll('SELECT * FROM invoices WHERE party_id=? AND is_deleted=0 ORDER BY invoice_date', [partyId]);
    const txns = await queryAll('SELECT * FROM transactions WHERE party_id=? AND is_deleted=0 ORDER BY txn_date', [partyId]);

    const workbook = new ExcelJS.Workbook();
    const wsInv = workbook.addWorksheet('Invoices');
    wsInv.columns = [
      { header: 'Invoice No.', key: 'invoice_number' },
      { header: 'Date', key: 'invoice_date' },
      { header: 'Type', key: 'invoice_type' },
      { header: 'Amount (₹)', key: 'amount' },
      { header: 'Remarks', key: 'remarks' }
    ];
    invoices.forEach(i => wsInv.addRow({ ...i, amount: paiseTo(i.amount) }));
    wsInv.getColumn('amount').numFmt = RUPEE_FORMAT;
    styleWorksheet(wsInv);

    const wsTxn = workbook.addWorksheet('Transactions');
    wsTxn.columns = [
      { header: 'Date', key: 'txn_date' },
      { header: 'Type', key: 'txn_type' },
      { header: 'Category', key: 'category' },
      { header: 'Amount (₹)', key: 'amount' },
      { header: 'Remarks', key: 'remarks' }
    ];
    txns.forEach(t => wsTxn.addRow({ ...t, amount: paiseTo(t.amount) }));
    wsTxn.getColumn('amount').numFmt = RUPEE_FORMAT;
    styleWorksheet(wsTxn);
    await sendWorkbook(res, workbook, `PartyStatement_${party.party_name.replace(/\s+/g, '_')}.xlsx`);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 6. Full Data Export
router.get('/full-data', async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();

    const parties = await queryAll('SELECT * FROM parties WHERE is_deleted=0');
    const wsP = workbook.addWorksheet('Parties');
    wsP.columns = [
      { header: 'ID', key: 'party_id' }, { header: 'Name', key: 'party_name' }, { header: 'Type', key: 'party_type' },
      { header: 'Phone', key: 'phone' }, { header: 'Address', key: 'address' }, { header: 'Opening Bal (₹)', key: 'opening_balance' }, { header: 'Notes', key: 'notes' }
    ];
    parties.forEach(p => wsP.addRow({ ...p, opening_balance: paiseTo(p.opening_balance) }));
    styleWorksheet(wsP);

    const invoices = await queryAll(`SELECT i.*, p.party_name FROM invoices i JOIN parties p ON i.party_id=p.party_id WHERE i.is_deleted=0`);
    const wsI = workbook.addWorksheet('Invoices');
    wsI.columns = [
      { header: 'ID', key: 'invoice_id' }, { header: 'Invoice No.', key: 'invoice_number' }, { header: 'Date', key: 'invoice_date' },
      { header: 'Party', key: 'party_name' }, { header: 'Type', key: 'invoice_type' }, { header: 'Amount (₹)', key: 'amount' }, { header: 'Remarks', key: 'remarks' }
    ];
    invoices.forEach(i => wsI.addRow({ ...i, amount: paiseTo(i.amount) }));
    styleWorksheet(wsI);

    const txns = await queryAll(`SELECT t.*, p.party_name FROM transactions t LEFT JOIN parties p ON t.party_id=p.party_id WHERE t.is_deleted=0`);
    const wsT = workbook.addWorksheet('Transactions');
    wsT.columns = [
      { header: 'ID', key: 'txn_id' }, { header: 'Date', key: 'txn_date' }, { header: 'Type', key: 'txn_type' },
      { header: 'Category', key: 'category' }, { header: 'Party', key: 'party_name' }, { header: 'Amount (₹)', key: 'amount' }, { header: 'Remarks', key: 'remarks' }
    ];
    txns.forEach(t => wsT.addRow({ ...t, amount: paiseTo(t.amount) }));
    styleWorksheet(wsT);

    const logs = await queryAll('SELECT * FROM audit_log ORDER BY changed_at DESC');
    const wsA = workbook.addWorksheet('Audit Log');
    wsA.columns = [
      { header: 'ID', key: 'log_id' }, { header: 'Time', key: 'changed_at' }, { header: 'Action', key: 'action_type' },
      { header: 'Table', key: 'table_affected' }, { header: 'Record ID', key: 'record_id' }, { header: 'Details', key: 'remarks' }
    ];
    logs.forEach(l => wsA.addRow(l));
    styleWorksheet(wsA);

    await sendWorkbook(res, workbook, 'FullDataExport.xlsx');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

export default router;
