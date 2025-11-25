# N8N Gemini Image Generator with WordPress Integration - Project Requirements

## 1. PROJECT OVERVIEW

### 1.1 Goal
Create an n8n community node that:
- Generates images using Google Gemini API (model: `gemini-3-pro-image-preview`)
- Optionally uploads generated images to WordPress Media Library
- Automatically sets uploaded image as featured image for a WordPress post
- All functionality in ONE single node (not multiple nodes)

### 1.2 Package Information
- **Package Name**: `n8n-nodes-wordpress-nano-banana`
- **Display Name**: Gemini Image Generator
- **Distribution**: npm registry (public)
- **Installation**: Via n8n UI → Settings → Community Nodes

### 1.3 Origin
Converted from bash curl script to n8n community node:
```bash
# Original curl command structure
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:streamGenerateContent?key=API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [{"text": "prompt here"}]
    }],
    "generationConfig": {
      "responseModalities": ["IMAGE", "TEXT"],
      "imageConfig": {
        "aspectRatio": "16:9",
        "imageSize": "1K"
      }
    }
  }'
```

---

## 2. WORKFLOW USE CASE

### 2.1 Target Workflow
```
WordPress Update Post
    ↓ (outputs post data: id, title, etc.)
Gemini Image Generator
    ↓ (generates image + uploads to WP + sets featured_media)
[End]
```

### 2.2 Data Flow
1. **Input from WordPress node**: `{ id: 123, title: "Post Title", ... }`
2. **Generate image**: Use post title in prompt via n8n expression: `{{ $json.title }}`
3. **Upload to WordPress**: POST to `/wp-json/wp/v2/media`
4. **Set featured image**: POST to `/wp-json/wp/v2/posts/{id}` with `featured_media`
5. **Output**: Return success info with media ID and URL

---

## 3. TECHNICAL REQUIREMENTS

### 3.1 n8n Node Structure

#### 3.1.1 Credentials (2 required)
**Credential 1: Gemini API**
- File: `credentials/GeminiApi.credentials.ts`
- Type: `ICredentialType`
- Name: `geminiApi`
- Display Name: `Gemini API`
- Properties:
  - `apiKey`: string, password type, required
- Authentication: Generic auth via query string `?key={{$credentials.apiKey}}`
- Test endpoint: `https://generativelanguage.googleapis.com/v1beta/models`

**Credential 2: WordPress API**
- File: `credentials/WordPressApi.credentials.ts`
- Type: `ICredentialType`
- Name: `wordPressApi`
- Display Name: `WordPress API`
- Properties:
  - `url`: WordPress site URL (e.g., `https://example.com`)
  - `username`: WordPress username
  - `password`: WordPress Application Password (or regular password)
- Authentication: HTTP Basic Auth
- Test endpoint: `{{$credentials.url}}/wp-json/wp/v2/users/me`

#### 3.1.2 Node Definition
- File: `nodes/GeminiImageGenerator/GeminiImageGenerator.node.ts`
- Class: `GeminiImageGenerator implements INodeType`
- Name: `geminiImageGenerator`
- Display Name: `Gemini Image Generator`
- Icon: `file:gemini.svg`
- Group: `['transform']`
- Version: Should increment with major changes

#### 3.1.3 Node Parameters (Properties)

**CRITICAL REQUIREMENT**: Parameters must appear in THIS EXACT ORDER:

1. **Enable WordPress Upload** (Toggle)
   - Name: `enableWordPressUpload`
   - Type: `boolean`
   - Default: `false`
   - Description: Whether to automatically upload the generated image to WordPress and set it as featured image
   - **MUST BE FIRST PARAMETER** (before all other properties)

2. **Prompt** (Text Area)
   - Name: `prompt`
   - Type: `string`
   - Rows: 6
   - Default: Empty string `''` (no default text)
   - Required: `true`
   - Description: Prompt for image generation. Use expressions like `{{ $json.title }}`
   - Supports n8n expressions

3. **Aspect Ratio** (Dropdown)
   - Name: `aspectRatio`
   - Type: `options`
   - Options: `16:9`, `9:16`, `4:3`, `3:4`, `1:1`
   - Default: `16:9`

4. **Image Size** (Dropdown)
   - Name: `imageSize`
   - Type: `options`
   - Options: `1K (1024px)`, `2K (2048px)`, `4K (4096px)`
   - Default: `1K`

5. **Post ID** (Conditional - Only when WordPress Upload ON)
   - Name: `postId`
   - Type: `string`
   - Default: `={{ $json.id }}`
   - Required: `true`
   - Display Options: Show only when `enableWordPressUpload: [true]`
   - Description: WordPress post ID to set featured image for

6. **Output Format** (Conditional - Only when WordPress Upload OFF)
   - Name: `outputFormat`
   - Type: `options`
   - Options: `binary`, `base64`, `json` (for debug)
   - Default: `binary`
   - Display Options: Show only when `enableWordPressUpload: [false]`

7. **Binary Property Name** (Conditional - Only when Output Format = binary AND WordPress Upload OFF)
   - Name: `binaryPropertyName`
   - Type: `string`
   - Default: `data`
   - Display Options: Show only when `outputFormat: ['binary']` AND `enableWordPressUpload: [false]`

### 3.2 Gemini API Integration

#### 3.2.1 API Endpoint
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:streamGenerateContent?key={API_KEY}
```

#### 3.2.2 Request Body Structure
**IMPORTANT**: Use `generationConfig` (NOT `config`). This is REST API format, not SDK format.

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "prompt text here"
        }
      ]
    }
  ],
  "generationConfig": {
    "responseModalities": ["IMAGE", "TEXT"],
    "imageConfig": {
      "aspectRatio": "16:9",
      "imageSize": "1K"
    }
  }
}
```

#### 3.2.3 Response Parsing
Response can be:
- Single object: `{ candidates: [...] }`
- Array of chunks: `[{ candidates: [...] }, ...]`

Image data location (check both formats):
1. `response.candidates[0].content.parts[0].inlineData.data` (SDK format - camelCase)
2. `response.candidates[0].content.parts[0].inline_data.data` (REST API format - snake_case)

MIME type location:
1. `inlineData.mimeType` (SDK format)
2. `inline_data.mime_type` (REST API format)

Image data is **base64 encoded string**.

### 3.3 WordPress API Integration

#### 3.3.1 Upload Image to Media Library
```
POST {wordpress_url}/wp-json/wp/v2/media
Headers:
  - Content-Disposition: attachment; filename="featured-image-{timestamp}.png"
  - Content-Type: {mimeType}
  - Authorization: Basic {base64(username:password)}
Body: Binary image data (Buffer)
```

Response includes:
- `id`: Media ID
- `source_url`: Image URL

#### 3.3.2 Set Featured Image
```
POST {wordpress_url}/wp-json/wp/v2/posts/{postId}
Headers:
  - Content-Type: application/json
  - Authorization: Basic {base64(username:password)}
Body:
{
  "featured_media": {media_id}
}
```

---

## 4. KEY FIXES IN THIS VERSION

### 4.1 Parameter Order
- ✅ `enableWordPressUpload` is now the FIRST parameter in the properties array
- ✅ This ensures displayOptions work correctly for both credentials and other parameters

### 4.2 Credential Configuration
- ✅ Gemini API credential is always required
- ✅ WordPress API credential is conditionally required (only when toggle is ON)
- ✅ Both credentials use proper displayOptions that reference the first parameter

### 4.3 API Integration
- ✅ Uses `generationConfig` (REST API format) instead of `config`
- ✅ Checks both camelCase (`inlineData`) and snake_case (`inline_data`) formats
- ✅ Proper error handling with response previews

### 4.4 WordPress Integration
- ✅ Proper HTTP Basic Auth implementation
- ✅ Correct headers for media upload
- ✅ Two-step process: upload image → set featured_media
- ✅ Returns comprehensive success information

---

## 5. TESTING CHECKLIST

### 5.1 UI Testing
- [ ] Toggle "Enable WordPress Upload" is visible at the top
- [ ] Gemini API credential selector always shows
- [ ] WordPress API credential selector only shows when toggle is ON
- [ ] Post ID field only shows when toggle is ON
- [ ] Output Format field only shows when toggle is OFF
- [ ] Binary Property Name only shows when toggle is OFF and format is Binary

### 5.2 Functional Testing

**Test 1: Generate Image Only**
- Input: `{ title: "Test" }`
- Toggle: OFF
- Expected: Binary image data

**Test 2: Generate + Upload to WordPress**
- Input: `{ id: 123, title: "Test Post" }`
- Toggle: ON
- Expected: Success message with media ID and URL

**Test 3: Error Handling**
- Missing credentials → Clear error
- Invalid API key → API error
- Missing post ID → Validation error

---

## 6. VERSION HISTORY

- **v4.0.0** (2024-11-25): Complete rewrite with fixed parameter order and credential handling
- **v3.0.3**: Previous version with UI issues
- Earlier versions: Various experimental configurations

---

**Document Version**: 2.0
**Last Updated**: 2024-11-25
**Status**: Complete Rewrite
