# 🔍 DIAGNOSTIC INSTRUCTIONS FOR AWS PRODUCTION

## Step 1: Deploy Updated Code with Debugging

SSH into your AWS instance:
```bash
ssh ubuntu@ip-172-26-2-139
cd ~/delight-gantt
```

Pull latest code (or copy updated files):
```bash
git pull origin main
# OR manually update the files
```

Rebuild and restart:
```bash
docker compose down
docker compose build --no-cache backend
docker compose up -d
```

## Step 2: Access the New Debug Endpoint

Open browser and visit:
```
https://gantt.delightful.ph/api/auth/debug
```

**Copy the ENTIRE JSON response and share it with me.**

This will show:
- Request protocol (HTTP vs HTTPS detection)
- All proxy headers (X-Forwarded-*)
- Session information
- Cookie presence
- Environment configuration

## Step 3: Attempt Login and Capture Logs

In terminal, run:
```bash
docker compose logs -f backend | tee login-debug.log
```

In browser:
1. Clear all cookies for gantt.delightful.ph
2. Open DevTools → Network tab
3. Go to https://gantt.delightful.ph/login
4. Click "Login with Microsoft"
5. Complete authentication
6. Watch the logs in terminal

**Look for these log entries:**
- `[Session Middleware] Auth route accessed`
- `[Auth Callback] Request Details`
- `[Auth Callback] User data saved to session`
- `[Auth Callback] Session saved successfully`
- `[Auth Session Check] Request Details`
- `[Auth Session Check] ✅ User found in session` OR `[Auth Session Check] ❌ No user in session`

## Step 4: Check Browser DevTools

### A. Network Tab
After clicking login, find these requests:
1. `GET /api/auth/callback?code=...`
   - Check **Response Headers** for `Set-Cookie: gantt.sid=...`
   - **Screenshot this**
   
2. `GET /api/auth/session`
   - Check **Request Headers** for `Cookie: gantt.sid=...`
   - Check **Response** body
   - **Screenshot this**

### B. Application Tab
Go to: Application → Cookies → https://gantt.delightful.ph
- Is `gantt.sid` cookie present?
- What are its attributes (Secure, HttpOnly, SameSite, Domain, Path)?
- **Screenshot this**

## Step 5: Share These with Me

Please provide:
1. ✅ Output from `/api/auth/debug` endpoint
2. ✅ Backend logs from login attempt (login-debug.log)
3. ✅ Screenshots of Network tab (callback and session requests)
4. ✅ Screenshot of Application → Cookies

## Quick Checks (Do These First)

### Check 1: Verify Code Changes Deployed
```bash
docker exec gantt-backend cat /app/server/index.js | grep -A 5 "secure:"
```
Should show: `secure: 'auto',`

### Check 2: Check Nginx X-Forwarded-Proto
```bash
sudo cat /etc/nginx/sites-enabled/gantt.delightful.ph | grep -i forward
```
Should show headers being set.

### Check 3: Test Debug Endpoint from Server
```bash
curl -v http://localhost:3001/api/auth/debug
```
Note the protocol detection.

## Cloudflare Check

1. Go to Cloudflare Dashboard
2. Select domain: delightful.ph
3. Go to SSL/TLS
4. Check encryption mode - should be **"Full"** or **"Full (strict)"**, NOT "Flexible"
5. **Screenshot this setting**

---

After gathering this information, we'll know exactly why the session isn't persisting.
