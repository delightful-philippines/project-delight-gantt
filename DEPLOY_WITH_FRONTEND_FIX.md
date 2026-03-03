# 🚀 COMPLETE DEPLOYMENT INSTRUCTIONS

## Current Status
✅ Backend session is working (confirmed via debug endpoint)
❓ Frontend might be serving cached/old code

## Step 1: Deploy Backend + Frontend Changes

SSH into AWS:
```bash
ssh ubuntu@ip-172-26-2-139
cd ~/delight-gantt
```

Pull latest code:
```bash
git pull origin main
```

Rebuild BOTH containers (frontend needs the new logging):
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

Verify containers are running:
```bash
docker compose ps
```

## Step 2: Test with Browser Console Open

**CRITICAL: You must open browser DevTools Console BEFORE testing**

1. **Open browser in Incognito/Private mode** (clean slate)
2. **Press F12** to open DevTools
3. **Go to Console tab**
4. **Clear all cookies** for gantt.delightful.ph:
   - Application tab → Cookies → gantt.delightful.ph → Delete all

5. **Navigate to**: `https://gantt.delightful.ph`

6. **Watch the console logs** - you should see:
   ```
   [App] 🚀 App mounted, initiating session check...
   [AuthStore] 🔍 Starting session check...
   [AuthStore] Session response status: 200 true
   [AuthStore] ✅ Session Data: { user: null }
   [AuthStore] User exists: false
   [App] Auth state changed: { isAuthenticated: false, isLoading: false }
   [ProtectedRoute] ❌ Not authenticated, redirecting to /login
   ```

7. **Click "Login with Microsoft"**

8. **After completing Azure authentication**, watch for:
   ```
   [App] 🚀 App mounted, initiating session check...
   [AuthStore] 🔍 Starting session check...
   [AuthStore] Session response status: 200 true
   [AuthStore] ✅ Session Data: { user: { email: 'jed.tan@brigada.com.ph', ... } }
   [AuthStore] User exists: true
   [AuthStore] Setting isAuthenticated to: true
   [App] Auth state changed: { isAuthenticated: true, isLoading: false }
   [App] ✅ User authenticated, initializing Gantt store...
   [ProtectedRoute] ✅ Authenticated, rendering protected content
   ```

## Step 3: What to Look For

### ✅ SUCCESS - You'll see:
- Page loads projects list (not /login)
- Console shows `isAuthenticated: true`
- No redirect loop

### ❌ FAILURE Scenarios:

**Scenario A: Session data is null after login**
```
[AuthStore] ✅ Session Data: { user: null }
```
→ Backend session not being set. Check backend logs.

**Scenario B: Response not OK**
```
[AuthStore] ❌ Response not OK, status: 401
```
→ CORS or credentials issue.

**Scenario C: Redirect loop (page keeps reloading)**
- Check if you see repeated `[App] 🚀 App mounted` logs
- This means infinite redirect between / and /login

**Scenario D: Old code still loading (no console logs)**
→ Frontend not rebuilt. Re-run build commands.

## Step 4: Capture Diagnostics

If it still fails, run this and share the output:

```bash
# Backend logs during login
docker compose logs --tail=100 backend | grep -E '\[Auth|\[Session'

# Check if frontend was rebuilt
docker compose exec frontend cat /app/package.json | grep name

# Check frontend build timestamp
docker compose images
```

## Step 5: Browser Cache Nuclear Option

If you still see old behavior:

1. **Clear ALL site data**:
   - F12 → Application tab → Storage → Clear site data

2. **Force reload**:
   - Windows: Ctrl + Shift + R
   - Mac: Cmd + Shift + R

3. **Or use Incognito mode** (guaranteed fresh)

## Expected Timeline
- Backend rebuild: 2-3 minutes
- Frontend rebuild: 3-5 minutes
- Total deployment: 5-8 minutes

---

## Share These with Me:

1. ✅ Complete console logs from browser (copy entire console output)
2. ✅ Backend logs: `docker compose logs --tail=100 backend`
3. ✅ Screenshot of final page (are you on /login or projects list?)
4. ✅ Network tab screenshot of `/api/auth/session` request + response

This will tell us EXACTLY where the flow breaks.
