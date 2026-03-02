/**
 * server/index.js
 * ─────────────────────────────────────────────────────────────
 * Project Delight Gantt — Express API Server
 *
 * Security model:
 *   • VITE_SUPABASE_SERVICE_ROLE_KEY lives ONLY here — never in the browser
 *   • All DB access goes through supabaseAdmin (bypasses RLS)
 *   • Frontend uses the anon key client for real-time features only
 * ─────────────────────────────────────────────────────────────
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { runMigrations } from './migrate.js';
import projectsRouter  from './routes/projects.js';
import tasksRouter     from './routes/tasks.js';
import baselinesRouter from './routes/baselines.js';
import usersRouter     from './routes/users.js';
import employeesRouter from './routes/employees.js';
import authRouter      from './routes/auth.js';

import session from 'express-session';
import cookieParser from 'cookie-parser';

const app  = express();
const PORT = process.env.PORT ?? 3001;

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',   // Vite dev server
    'http://localhost:4173',   // Vite preview
    process.env.FRONTEND_URL,  // Production URL (set in .env)
  ].filter(Boolean),
  credentials: true,
}));

app.use(express.json({ limit: '10mb' })); // allow large project payloads
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_only',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true if production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Project Delight Gantt API',
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ───────────────────────────────────────────────────
app.use('/api/projects',  projectsRouter);
app.use('/api/tasks',     tasksRouter);
app.use('/api/baselines', baselinesRouter);
app.use('/api/users',     usersRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/auth',      authRouter);

// ── 404 fallback ─────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

// ── Global error handler ─────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Boot ─────────────────────────────────────────────────────
async function boot() {
  console.log('\n🚀  Project Delight Gantt — API Server');
  console.log('═'.repeat(42));

  // Run DB migrations before accepting requests
  await runMigrations();

  app.listen(PORT, () => {
    console.log(`✅  Server listening on http://localhost:${PORT}`);
    console.log(`📡  API base:   http://localhost:${PORT}/api`);
    console.log(`❤️   Health:     http://localhost:${PORT}/api/health\n`);
  });
}

boot().catch(err => {
  console.error('❌  Failed to start server:', err);
  process.exit(1);
});
