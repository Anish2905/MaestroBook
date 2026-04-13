# Maestro Engineering Works — User Guide

---

## Getting Started

Launch **Maestro Engineering Books** from your desktop shortcut or Start Menu.

The application opens to the **Dashboard**, which gives you a complete financial overview at a glance.

---

## The Interface

```
┌─────────────────┬──────────────────────────────────────────┐
│   SIDEBAR       │   TOPBAR (title, search, buttons)        │
│   Navigation    ├──────────────────────────────────────────┤
│   + Backup Info │   CONTENT AREA                           │
└─────────────────┴──────────────────────────────────────────┘
```

**Sidebar:** Tap any item to switch screens. The **M** logo is at the top. The green chip at the bottom shows the last backup time.

**Topbar:** The `+ New Entry` button opens the form for adding any type of record. `Backup Now` saves your data immediately.

---

## Screen 1 — Dashboard

The Dashboard shows four key metrics at the top:

| Card | What it means |
|------|--------------|
| **Total To Get** | Money customers owe you (green) |
| **Total To Pay** | Money you owe vendors (red) |
| **Net Balance** | To Get minus To Pay (gold) |
| **This Month Sales** | Total sale invoices this month (blue) |

Below the cards:
- **Recent Transactions** — Last 10 entries
- **Top Outstanding (To Get)** — Customers with the highest pending balances

---

## Screen 2 — Party Ledger

Manage all your **Vendors and Customers** here.

**Left panel:** List of all parties. Click any party to select it. Use the search box to find quickly.

**Right panel (after selecting a party):**
- Party name, phone, address
- 3 stat boxes: Total Billed / Total Received / Balance Outstanding
- **Edit** button to update party details
- **+ Add Invoice** button to add a purchase or sale invoice
- Invoice history table below

**Balance colors:**
- Green badge = Customer (money coming in)
- Red badge = Vendor (money going out)

---

## Screen 3 — Expenses & Receipts

All transactions in one table — both incoming (receipts) and outgoing (payments/expenses).

**Filters at the top:**
- **Category** — Filter by Salary, Material Purchase, Electricity, etc.
- **Month** — Filter by any month

**Summary cards:** Total Outgoing / Total Incoming / Net Cash Flow for the filtered period.

**Table columns:**
- `#` — Transaction ID (e.g., T-0041)
- Date, Party/Category, Type badge, Remarks
- Amount — red with `−` for payments, green with `+` for receipts
- `✎` edit button on the right

**Adding an entry:** Click `+ Add Entry` button top-right, or use `Ctrl+N` from anywhere.

---

## Screen 4 — Balance Tracker

Two tabs showing exactly what you owe and what you're owed:

**To Pay (Payable)** — Vendors you owe money to
- Columns: Vendor | Total Invoiced | Total Paid | Balance | Progress bar | Pay button
- Red balance = amount still due

**To Get (Receivable)** — Customers who owe you money  
- Columns: Customer | Total Billed | Total Received | Balance | Progress bar | Receipt button
- Green balance = amount still to collect

**Progress bar colors:**
- 🟢 Green = more than 66% cleared
- 🟡 Amber = 33–66% cleared
- 🔴 Red = less than 33% cleared

**Manual Override:** If you need to directly adjust a party's balance (e.g., to account for a discount or write-off), click `Manual Override` in the top-right. You must enter a reason — this is logged in the Audit Log.

---

## Screen 5 — Export to XLS

Six export types to download as Excel files:

| Export | Contents |
|--------|----------|
| Party Ledger | All parties with opening balances |
| Invoice Register | All purchase and sale invoices |
| Transaction Log | All payments and receipts |
| Outstanding Report | Payable & receivable by party |
| Party Statement | Full history for one party |
| Full Data Export | All sheets in one workbook |

Click any card to open a file-save dialog. The Full Data Export (dashed border) is the complete backup of all data.

---

## Screen 6 — Audit Log

Every change made in the system is recorded here automatically. You cannot edit or delete audit log entries.

**Columns:** Time | Action | Record | Changed By | Details

**Action badges:**
- 🟢 INSERT — new record created
- 🟡 UPDATE — existing record changed
- 🔴 DELETE — record soft-deleted
- 🟣 OVERRIDE — manual balance adjustment

---

## Screen 7 — Settings

**Company Details:** Change the company name or financial year start month. Click Save.

**Backup Settings:**
- View default backup folder path
- Set how many backups to keep (default: 30)
- `Backup Now` — create an immediate backup
- `Restore from Backup` — browse to a `.db` file to restore (this restarts the app)

**Database Info:** Live stats — database file size, total records, integrity status, WAL mode.

**App Info:** Version and technical details.

---

## Adding New Entries

Press `Ctrl+N` or click `+ New Entry` from anywhere. Choose the entry type:

### Invoice (Purchase / Sale)
For recording goods bought or sold.
- Select the party, choose Purchase or Sale
- Enter invoice number (optional), amount, date
- Add remarks if needed

### Expense / Payment Made
For paying a vendor (with or without a linked invoice) or recording costs like salary, electricity, transport.
- Select the expense category
- Party and linked invoice are optional (for general expenses like salary, leave blank)

### Receipt (Money Received)
For recording money received from a customer.
- Select the customer party
- Optionally link to an invoice

### New Party
Add a new customer or vendor.
- Enter name, type (Customer/Vendor/Both), phone, address
- Opening balance: if they already owe you money (or you owe them) when you start using the software

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | Open New Entry modal |
| `Ctrl+B` | Backup Now |
| `Ctrl+E` | Go to Export screen |
| `Ctrl+F` | Focus the search bar |
| `Escape` | Close the open modal |

---

## Data Safety

- Your data is stored locally at: `C:\Users\[YourName]\AppData\Roaming\maestro-engineering-books\`
- **Auto-backup:** Every time you launch the app, a backup is created automatically
- **Manual backup:** Press `Ctrl+B` or click `Backup Now` at any time
- Backups are stored in the `backups` subfolder; the last 30 are kept
- To restore: Go to Settings → Restore from Backup → select a `.db` file

---

## Tips

- All amounts are in **Indian Rupees (₹)**
- Invoice numbers are optional — the system assigns an internal ID
- Deleted records are never physically removed — they're hidden (soft delete) and visible in the Audit Log
- The database uses WAL mode for safety — even if the app crashes, your data is protected

---

*Maestro Engineering Books v1.0.0 — Built for Windows 10/11*
