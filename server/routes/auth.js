import { Router } from 'express';
import { getAuthUrl, acquireTokenByCode } from '../lib/auth_msal.js';
import { supabaseAdmin } from '../db.js';

const router = Router();

router.get('/login', async (req, res) => {
    try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const redirectUri = `${protocol}://${host}/api/auth/callback`;
        
        const authUrl = await getAuthUrl(req.query.state || '/', redirectUri);
        res.redirect(authUrl);
    } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).send('Authentication initialization failed');
    }
});

router.get('/callback', async (req, res) => {
    // DEBUG: Log request details
    console.log('[Auth Callback] Request Details:', {
        protocol: req.protocol,
        secure: req.secure,
        hostname: req.hostname,
        'x-forwarded-proto': req.headers['x-forwarded-proto'],
        'x-forwarded-host': req.headers['x-forwarded-host'],
        host: req.headers.host,
        sessionID: req.sessionID,
        hasSession: !!req.session
    });

    if (req.query.error) {
        return res.status(400).send(`Error: ${req.query.error_description}`);
    }

    try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const redirectUri = `${protocol}://${host}/api/auth/callback`;

        const response = await acquireTokenByCode(req.query.code, redirectUri);
        
        // Save user to session
        req.session.user = {
            name: response.account.name,
            email: response.account.username.toLowerCase(),
            homeAccountId: response.account.homeAccountId,
            tenantId: response.account.tenantId
        };

        console.log('[Auth Callback] User data saved to session:', {
            email: req.session.user.email,
            sessionID: req.sessionID
        });

        // Explicitly save session before redirecting
        req.session.save((err) => {
            if (err) {
                console.error('[Auth Callback] Session save FAILED:', err);
                return res.status(500).send('Session save failed');
            }
            
            console.log('[Auth Callback] Session saved successfully, redirecting to /');
            console.log('[Auth Callback] Set-Cookie headers:', res.getHeader('Set-Cookie'));
            
            // Dynamically determine the base URL to prevent "jumping" to production
            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const host = req.headers['x-forwarded-host'] || req.headers.host;
            
            let baseUrl = `${protocol}://${host}`;
            
            // LOCAL FIX: If we are on the API port (3001), redirect back to the Frontend port (5173)
            if (host === 'localhost:3001' || host === '127.0.0.1:3001') {
                baseUrl = 'http://localhost:5173';
            }
            
            console.log('[Auth Callback] Final Redirect to:', baseUrl);
            res.redirect(`${baseUrl}/`);
        });

    } catch (error) {
        console.error('[Auth] Token exchange failed:', error);
        res.status(500).send('Login failed');
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// DEBUG ENDPOINT: Diagnostic information (remove in production)
router.get('/debug', (req, res) => {
    res.json({
        request: {
            protocol: req.protocol,
            secure: req.secure,
            hostname: req.hostname,
            host: req.headers.host,
            ip: req.ip,
            ips: req.ips
        },
        headers: {
            'x-forwarded-proto': req.headers['x-forwarded-proto'],
            'x-forwarded-host': req.headers['x-forwarded-host'],
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'x-real-ip': req.headers['x-real-ip'],
            'cookie': req.headers.cookie ? 'present (length: ' + req.headers.cookie.length + ')' : 'missing',
            'user-agent': req.headers['user-agent']
        },
        session: {
            id: req.sessionID,
            exists: !!req.session,
            hasUser: !!(req.session && req.session.user),
            userEmail: req.session?.user?.email,
            cookie: req.session?.cookie
        },
        environment: {
            NODE_ENV: process.env.NODE_ENV,
            trustProxy: req.app.get('trust proxy'),
            FRONTEND_URL: process.env.FRONTEND_URL
        }
    });
});

router.get('/session', async (req, res) => {
    // DEBUG: Log session check request details
    console.log('[Auth Session Check] Request Details:', {
        protocol: req.protocol,
        secure: req.secure,
        hostname: req.hostname,
        'x-forwarded-proto': req.headers['x-forwarded-proto'],
        host: req.headers.host,
        cookies: req.headers.cookie,
        sessionID: req.sessionID,
        hasSession: !!req.session,
        hasUser: !!(req.session && req.session.user),
        userEmail: req.session?.user?.email
    });

    if (req.session && req.session.user) {
        console.log('[Auth Session Check] ✅ User found in session:', req.session.user.email);
        try {
            const { data: employee } = await supabaseAdmin
                .from('employees')
                .select('first_name, last_name')
                .or(`company_email_add.eq.${req.session.user.email},personal_email_add.eq.${req.session.user.email}`)
                .single();

            res.json({ 
                user: { 
                    ...req.session.user, 
                    first_name: employee?.first_name || null, 
                    last_name: employee?.last_name || null 
                } 
            });
        } catch {
            res.json({ user: req.session.user });
        }
    } else {
        console.log('[Auth Session Check] ❌ No user in session - returning null');
        res.json({ user: null });
    }
});

export default router;
