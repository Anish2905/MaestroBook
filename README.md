# Maestro Engineering Works — Bookkeeping Software

A fully offline desktop bookkeeping application for furniture manufacturing, built with **Electron + React + SQLite**.

## Features

- 📊 **Dashboard** — Real-time metrics (receivable, payable, net balance, monthly sales)
- 📒 **Party Ledger** — Manage vendors and customers with full invoice history
- 💰 **Expenses & Receipts** — Track all incoming and outgoing transactions
- ⚖️ **Balance Tracker** — Payable/receivable views with progress tracking
- 📤 **XLS Export** — 6 exportable reports with branded Excel formatting
- 📝 **Audit Log** — Complete audit trail of all changes
- ⚙️ **Settings** — Company details, backup management, database info
- 🔒 **Auto Backup** — Automatic backups on launch with configurable retention

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Electron (electron-vite) |
| Frontend | React 18 + Plain CSS |
| Database | SQLite (better-sqlite3, WAL mode) |
| Export | ExcelJS |
| Typography | Sora + DM Mono (Google Fonts) |
| Packaging | electron-builder → .exe |

## Setup

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **Visual Studio Build Tools** (for native module compilation)
  - Run: `npm install -g windows-build-tools` (if not already installed)

### Install & Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
# Build the app
npm run build

# Create distributable
npm run dist
```

The installer will be created in the `dist/` folder.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+N | Open New Entry modal |
| Ctrl+B | Backup Now |
| Ctrl+E | Open Export screen |
| Ctrl+F | Focus search bar |
| Escape | Close modal |

## Database

- Location: `%APPDATA%/maestro-engineering-books/maestro_books.db`
- All monetary values stored as **integers in paise** (₹1 = 100 paise)
- WAL mode enabled for optimal performance
- Integrity check runs on every app launch

## Backups

- Auto-backup on every launch
- Stored in `%APPDATA%/maestro-engineering-books/backups/`
- Last 30 backups retained by default
- Manual backup via Ctrl+B or the "Backup Now" button
- Restore from any backup via Settings

## Project Structure

```
src/
├── main/              # Electron main process
│   ├── index.js       # App entry, window creation
│   ├── database.js    # SQLite init + schema
│   ├── ipc-handlers.js # All IPC CRUD handlers
│   ├── backup.js      # Backup/restore logic
│   └── export.js      # ExcelJS export pipeline
├── preload/
│   └── index.js       # contextBridge API
└── renderer/
    ├── index.html
    └── src/
        ├── App.jsx    # Root layout + routing
        ├── App.css    # Design system
        ├── components/ # Sidebar, Topbar, Modal, etc.
        ├── screens/   # 7 app screens
        ├── hooks/     # useToast, useData
        └── utils/     # formatCurrency, formatDate
```

## License

MIT
