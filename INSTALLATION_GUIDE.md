# Installation & Setup Guide

## Step 1: Install Package in n8n

1. Go to **Settings** → **Community Nodes**
2. Click **Install a community node**
3. Enter: `n8n-nodes-wordpress-nano-banana`
4. Click **Install**
5. **Restart n8n** (very important!)

## Step 2: Create Gemini API Credential

1. Go to **Settings** → **Credentials**
2. Click **Add Credential**
3. Search for: **"Gemini API"** (NOT "Gemini account")
4. Enter your Gemini API key
5. Click **Save**

## Step 3: Create WordPress API Credential

1. Go to **Settings** → **Credentials**
2. Click **Add Credential**
3. Search for: **"WordPress API"** (NOT "WordPress" or anything else)
4. You should see a form with 3 fields:
   - WordPress URL
   - Username
   - Password
5. Fill in all fields:
   - WordPress URL: `https://yoursite.com` (no trailing slash)
   - Username: Your WordPress username
   - Password: Application Password (create in WordPress → Users → Profile → Application Passwords)
6. Click **Save**

## Step 4: Verify Credentials

Go to **Settings** → **Credentials** and verify you have:
- ✅ One credential of type "Gemini API"
- ✅ One credential of type "WordPress API"

## Step 5: Use in Workflow

1. Add **Gemini Image Generator** node to workflow
2. Select credentials:
   - **First dropdown**: Select your "Gemini API" credential
   - **Second dropdown**: Select your "WordPress API" credential
3. Configure parameters:
   - Prompt: `Generate image for {{ $json.title }}`
   - Post ID: `{{ $json.id }}`
   - Aspect Ratio: Choose desired ratio
   - Image Size: Choose desired size

## Troubleshooting

### Problem: Second credential dropdown shows "Gemini API" instead of "WordPress API"

**Cause**: You created a second Gemini credential instead of WordPress credential.

**Solution**:
1. Go to Settings → Credentials
2. Delete the wrong credential (the second Gemini one)
3. Create NEW credential
4. **IMPORTANT**: When searching, type "WordPress API" exactly
5. Make sure the form shows 3 fields (URL, Username, Password), NOT just API Key

### Problem: Can't find "WordPress API" credential type

**Cause**: Package not installed correctly or n8n not restarted.

**Solution**:
1. Uninstall package: Settings → Community Nodes → Uninstall
2. Restart n8n completely
3. Reinstall package
4. Restart n8n again
5. Try creating credential again

### Problem: Node shows old version

**Cause**: n8n caching old node definition.

**Solution**:
1. Delete node from workflow
2. Save workflow
3. Refresh browser
4. Drag new node from sidebar
5. Configure again

## Expected UI

When configured correctly, your node should show:

```
┌─────────────────────────────────────┐
│ Gemini Image Generator              │
├─────────────────────────────────────┤
│ Credential to connect with          │
│ [Your Gemini API ▼]                 │  ← Shows Gemini credentials
├─────────────────────────────────────┤
│ Credential to connect with          │
│ [Your WordPress API ▼]              │  ← Shows WordPress credentials
├─────────────────────────────────────┤
│ Prompt                              │
│ Post ID                             │
│ Aspect Ratio                        │
│ Image Size                          │
└─────────────────────────────────────┘
```

## Still Having Issues?

If you still see Gemini API in second dropdown:
1. Take screenshot of Settings → Credentials page
2. Take screenshot of the credential creation dialog
3. Report issue with screenshots
