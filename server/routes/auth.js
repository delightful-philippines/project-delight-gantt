import { Router } from 'express';
import { getAuthUrl, acquireTokenByCode } from '../lib/auth_msal.js';
import { supabaseAdmin } from '../db.js';

const router = Router();

// ── GET /api/auth/login ───────────────────────────────────────────
// Redirect user to Microsoft Login
router.get('/login', async (req, res) => {
    try {
        const authUrl = await getAuthUrl(req.query.state || '/');
        res.redirect(authUrl);
    } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).send('Authentication initialized failed');
    }
});

// ── GET /api/auth/callback ────────────────────────────────────────
// Handle the redirect from Microsoft
router.get('/callback', async (req, res) => {
    // 1. Check for errors returned by Microsoft in the URL
    if (req.query.error) {
        console.error('[Auth] Microsoft returned an error:', req.query.error_description);
        return res.status(400).send(`
            <div style="font-family: sans-serif; padding: 40px; text-align: center;">
                <h2 style="color: #e11d48;">Authentication Error</h2>
                <p style="color: #64748b;">${req.query.error_description}</p>
                <a href="/login" style="color: #2563eb; text-decoration: none; font-weight: bold;">Return to Login</a>
            </div>
        `);
    }

    try {
        const response = await acquireTokenByCode(req.query.code);
        
        // Store user in session
        req.session.user = {
            name: response.account.name,
            email: response.account.username.toLowerCase(),
            homeAccountId: response.account.homeAccountId,
            tenantId: response.account.tenantId
        };

        // Redirect back to frontend
        const redirectPath = req.query.state || '/';
        const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendBase}${redirectPath}`);
    } catch (error) {
        console.error('[Auth] Token Exchange Failed!');
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        if (error.errorMessage) console.error('MSAL Error Message:', error.errorMessage);
        
        res.status(500).send(`
            <div style="font-family: sans-serif; padding: 40px; text-align: center;">
                <h2 style="color: #e11d48;">Token Exchange Failed</h2>
                <p style="color: #64748b;">The server could not verify your login with Microsoft.</p>
                <p style="font-family: monospace; background: #f1f5f9; padding: 10px; border-radius: 4px; display: inline-block;">${error.message}</p>
                <div style="margin-top: 20px;">
                    <a href="/login" style="color: #2563eb; text-decoration: none; font-weight: bold;">Try Again</a>
                </div>
            </div>
        `);
    }
});

// ── GET /api/auth/logout ──────────────────────────────────────────
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// ── GET /api/auth/session ─────────────────────────────────────────
// Check current session
router.get('/session', async (req, res) => {
    if (req.session && req.session.user) {
        try {
            // Enrich with name from employees table if available
            const { data: employee } = await supabaseAdmin
                .from('employees')
                .select('first_name, last_name')
                .eq('company_email_add', req.session.user.email)
                .single();

            const enrichedUser = {
                ...req.session.user,
                first_name: employee?.first_name || null,
                last_name: employee?.last_name || null,
            };

            res.json({ user: enrichedUser });
        } catch (error) {
            // If employee lookup fails, just return the session user as is
            res.json({ user: req.session.user });
        }
    } else {
        // Return 200 but null user to avoid "401 Unauthorized" red errors in console
        res.json({ user: null });
    }
});

// ── GET /api/auth/debug-session ──────────────────────────────────
router.get('/debug-session', (req, res) => {
    res.json({ session: req.session });
});

export default router;
