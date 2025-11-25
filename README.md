# n8n-nodes-wordpress-nano-banana

[![npm version](https://badge.fury.io/js/n8n-nodes-wordpress-nano-banana.svg)](https://www.npmjs.com/package/n8n-nodes-wordpress-nano-banana)

This is an n8n community node that generates images using Google Gemini API and automatically uploads them to WordPress as featured images.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Features

- 🎨 Generate images using Google Gemini API (model: `gemini-3-pro-image-preview`)
- 🖼️ Configurable aspect ratios: 16:9, 9:16, 4:3, 3:4, 1:1
- 📏 Multiple image sizes: 1K, 2K, 4K
- 📌 Automatically upload and set as featured image for WordPress posts
- 🚀 Simple and straightforward - no complex options
- 🔗 Works seamlessly with other n8n nodes

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Via n8n UI

1. Go to **Settings** > **Community Nodes**
2. Click **Install**
3. Enter `n8n-nodes-wordpress-nano-banana`
4. Click **Install**

### Via npm (for self-hosted)

```bash
npm install n8n-nodes-wordpress-nano-banana
```

## Credentials

This node requires the following credentials:

### Gemini API (Always Required)

1. Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. In n8n, create new credentials of type **Gemini API**
3. Enter your API key

### WordPress API (Required only when WordPress upload is enabled)

1. Create an Application Password in WordPress:
   - Go to Users > Profile
   - Scroll to "Application Passwords"
   - Create a new password
2. In n8n, create new credentials of type **WordPress API**
3. Enter:
   - WordPress URL (e.g., `https://example.com`)
   - Username
   - Application Password

## Usage

### Workflow Example

```
Workflow:
1. WordPress Trigger (or any node that provides post data)
   ↓
2. Gemini Image Generator
   ↓
3. Done!

Input: { id: 123, title: "My Blog Post" }

Node Configuration:
- Prompt: Generate a featured image for: {{ $json.title }}
- Post ID: {{ $json.id }}
- Aspect Ratio: 16:9
- Image Size: 2K

Output: {
  "success": true,
  "message": "Image generated and set as featured image",
  "wordpress": {
    "mediaId": 456,
    "mediaUrl": "https://site.com/wp-content/uploads/2024/image.png",
    "postId": "123"
  },
  "image": {
    "mimeType": "image/png",
    "fileSize": 123456,
    "fileName": "featured-image-1234567890.png"
  }
}
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Prompt | String | Yes | Text prompt for image generation (supports n8n expressions) |
| Post ID | String | Yes | WordPress post ID (supports n8n expressions like {{ $json.id }}) |
| Aspect Ratio | Dropdown | No | Image aspect ratio (16:9, 9:16, 4:3, 3:4, 1:1) |
| Image Size | Dropdown | No | Image size (1K, 2K, 4K) |

## Common Use Cases

1. **Automated Blog Thumbnails**: Generate featured images for WordPress posts based on titles
2. **Content Automation**: Automatically create and set featured images when publishing posts
3. **Bulk Post Processing**: Generate unique featured images for multiple posts at once
4. **Dynamic Visual Content**: Create context-aware images based on post content
5. **WordPress Content Pipelines**: Integrate AI image generation into automated publishing workflows

## Troubleshooting

### Node doesn't appear after installation
- Restart n8n server
- Check that the package is listed in Settings > Community Nodes
- Try reinstalling the package

### Credentials not working
- For Gemini API: Verify your API key is valid at [Google AI Studio](https://aistudio.google.com/app/apikey)
- For WordPress API: Make sure you're using Application Passwords, not regular passwords
- Check that WordPress URL doesn't have trailing slash

### Image generation fails
- Check your Gemini API quota
- Verify the prompt is not empty
- Check n8n logs for detailed error messages

### WordPress upload fails
- Verify WordPress credentials are correct
- Check that the post ID exists
- Ensure WordPress REST API is accessible

## Development

### Build

```bash
npm install
npm run build
```

### Publish

```bash
npm publish --access public
```

## License

[MIT](LICENSE)

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Google Gemini API documentation](https://ai.google.dev/gemini-api/docs)
- [WordPress REST API documentation](https://developer.wordpress.org/rest-api/)

## Support

- [GitHub Issues](https://github.com/tamtinhte365/n8n-nodes-wordpress-nano-banana/issues)
- [npm Package](https://www.npmjs.com/package/n8n-nodes-wordpress-nano-banana)
