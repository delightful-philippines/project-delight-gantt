/**
 * server/index.js
 * Project Delight Gantt — Express API Server (Cleaned)
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

import { runMigrations } from './migrate.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';
import baselinesRouter from './routes/baselines.js';
import usersRouter from './routes/users.js';
import employeesRouter from './routes/employees.js';
import authRouter from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ?? 3001;

// ── Infrastructure Configuration ───────────────────────────────
// Trust first proxy (Nginx) for X-Forwarded-* headers
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://gantt.delightful.ph',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// ── Session Configuration ──────────────────────────────────────
// NOTE: cookie-parser is removed as it conflicts with express-session in Express 4.x
app.use(session({
  name: 'gantt.sid',
  secret: process.env.SESSION_SECRET || 'production_secret_required',
  resave: false,
  saveUninitialized: false,
  proxy: true, 
  cookie: {
    path: '/',
    secure: 'auto', // Auto-detect HTTPS from X-Forwarded-Proto (works in both dev and prod)
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// DEBUG: Log session middleware behavior for auth routes
app.use((req, res, next) => {
  if (req.path.includes('/auth/')) {
    console.log('[Session Middleware] Auth route accessed:', {
      path: req.path,
      method: req.method,
      protocol: req.protocol,
      secure: req.secure,
      'x-forwarded-proto': req.headers['x-forwarded-proto'],
      hostname: req.hostname,
      cookieHeader: req.headers.cookie ? 'present' : 'missing',
      sessionID: req.sessionID,
      hasSessionUser: !!(req.session && req.session.user)
    });
  }
  next();
});

// ── Routes ───────────────────────────────────────────────────
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/baselines', baselinesRouter);
app.use('/api/users', usersRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/auth', authRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Silence Chrome DevTools internal requests (.well-known)
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => {
  res.status(204).end();
});

// ── 404 & Error Handling ─────────────────────────────────────
app.use('/api/*', (_req, res) => res.status(404).json({ error: 'API route not found.' }));

app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Boot ─────────────────────────────────────────────────────
async function boot() {
  console.log('\n🚀  Project Delight Gantt — API Server');
  await runMigrations();
  app.listen(PORT, () => {
    console.log(`✅ Server listening on port ${PORT}`);
  });
}

boot().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
