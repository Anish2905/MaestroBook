import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db.js';

// Routes
import partiesRouter from './routes/parties.js';
import invoicesRouter from './routes/invoices.js';
import transactionsRouter from './routes/transactions.js';
import dashboardRouter from './routes/dashboard.js';
import balanceRouter from './routes/balance.js';
import auditRouter from './routes/audit.js';
import settingsRouter from './routes/settings.js';
import searchRouter from './routes/search.js';
import exportsRouter from './routes/exports.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/parties', partiesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/balance', balanceRouter);
app.use('/api/audit', auditRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/search', searchRouter);
app.use('/api/exports', exportsRouter);

// Serve static files in production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback to index.html for SPA routing in production
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Initialize DB and start server
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// If this is the main module (not imported by Vercel), start the server
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  if (process.argv[1] === fileURLToPath(import.meta.url) || !process.env.VERCEL) {
    startServer();
  }
} else {
  // In Vercel, we need to make sure the database is initialized before handling requests.
  // We can't await it here at the top level without top-level await support, 
  // so we'll initialize it lazily middleware-style or just let it init lazily in db.js.
  // Actually, Turso is a remote DB, so initDatabase is safe to call asynchronously.
  initDatabase().catch(console.error);
}

export default app;
