# Fix: Credential Dropdown Shows Wrong Type

## Problem
When clicking "+ Create new credential" in the second dropdown (WordPress), it opens Gemini API form (1 field) instead of WordPress API form (3 fields).

## Root Cause
n8n is caching old version of the package where both credentials referenced `geminiApi`.

## Solution: Complete Package Reinstall

### Step 1: Uninstall Old Package
```
1. Go to Settings → Community Nodes
2. Find "n8n-nodes-wordpress-nano-banana"
3. Click the three dots → Uninstall
4. Wait for uninstall to complete
```

### Step 2: Restart n8n (CRITICAL!)
```
# Docker:
docker-compose restart n8n

# npm:
pkill n8n
n8n start

# pm2:
pm2 restart n8n

# Self-hosted:
Stop and start your n8n service
```

### Step 3: Clear Browser Cache
```
1. Close all n8n tabs
2. Clear browser cache (Ctrl+Shift+Delete)
3. Or use Incognito/Private mode
```

### Step 4: Install Latest Version
```
1. Go to Settings → Community Nodes
2. Click "Install a community node"
3. Enter: n8n-nodes-wordpress-nano-banana
4. Click Install
5. Wait for installation to complete
```

### Step 5: Restart n8n Again
```
Restart n8n one more time after installation
```

### Step 6: Verify Installation
```
1. Go to Settings → Credentials
2. Click "Add Credential"
3. Search for "WordPress API"
4. Click on it
5. Verify you see 3 fields:
   - WordPress URL
   - Username
   - Password
```

### Step 7: Create Fresh Credentials

**Delete old credentials first:**
```
Settings → Credentials →
Delete "Gemini account" (if multiple)
Delete "Wordpress account"
```

**Create new credentials:**

**Gemini API:**
```
1. Settings → Credentials → Add Credential
2. Search: "Gemini API"
3. Enter API Key
4. Save with name: "Gemini Production"
```

**WordPress API:**
```
1. Settings → Credentials → Add Credential
2. Search: "WordPress API"
3. Enter:
   - WordPress URL: https://tamcongnghe.com
   - Username: tamcongnghe
   - Password: [Application Password]
4. Save with name: "WordPress Production"
```

### Step 8: Use in Workflow
```
1. Create new workflow (or open existing)
2. Delete old "Gemini Image Generator" node
3. Add NEW "Gemini Image Generator" node
4. Select credentials:
   - First dropdown: "Gemini Production"
   - Second dropdown: "WordPress Production" (should now appear!)
5. Configure parameters
6. Test
```

## Expected Result

After following these steps, the second credential dropdown should show WordPress credentials, and clicking "+ Create new credential" should open the WordPress form with 3 fields.

## If Still Not Working

1. Check n8n version: `n8n --version`
   - Minimum version required: 0.200.0+

2. Check package is installed:
   ```bash
   cd ~/.n8n/nodes
   ls -la
   # Should see n8n-nodes-wordpress-nano-banana@4.1.1
   ```

3. Check n8n logs for errors:
   ```bash
   # Docker
   docker logs n8n

   # pm2
   pm2 logs n8n
   ```

4. Try manual installation:
   ```bash
   cd ~/.n8n
   npm install n8n-nodes-wordpress-nano-banana@latest
   # Restart n8n
   ```

## Still Having Issues?

The issue is definitely n8n caching. Try:
1. Delete `~/.n8n/nodes/n8n-nodes-wordpress-nano-banana` folder completely
2. Restart n8n
3. Reinstall package via UI
4. Restart n8n again

## Debug: Check What n8n Sees

If you have access to n8n CLI:
```bash
# Check registered credentials
n8n list:credentials

# Check registered nodes
n8n list:nodes
```

You should see both:
- `geminiApi`
- `wordPressApi`

If you only see `geminiApi`, the package is not installed correctly.
