import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class GeminiImageGenerator implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Gemini Image Generator',
		name: 'geminiImageGenerator',
		icon: 'file:gemini.svg',
		group: ['transform'],
		version: 10,
		description: 'Generate images using Google Gemini API and upload to WordPress as featured image',
		defaults: {
			name: 'Gemini Image Generator',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'geminiApi',
				required: true,
			},
			{
				name: 'wordpressApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: {
					rows: 6,
				},
				default: '',
				required: true,
				placeholder: 'Generate an image about {{ $json.title }}',
				description: 'Prompt for image generation. You can use n8n expressions like {{ $json.title }}.',
			},
			{
				displayName: 'Post ID',
				name: 'postId',
				type: 'string',
				default: '={{ $json.id }}',
				required: true,
				description: 'WordPress post ID to set the featured image for. Use expressions like {{ $json.id }}.',
			},
			{
				displayName: 'Aspect Ratio',
				name: 'aspectRatio',
				type: 'options',
				options: [
					{
						name: '16:9 (Landscape)',
						value: '16:9',
					},
					{
						name: '9:16 (Portrait)',
						value: '9:16',
					},
					{
						name: '4:3 (Standard)',
						value: '4:3',
					},
					{
						name: '3:4 (Portrait)',
						value: '3:4',
					},
					{
						name: '1:1 (Square)',
						value: '1:1',
					},
				],
				default: '16:9',
				description: 'Aspect ratio for the generated image',
			},
			{
				displayName: 'Image Size',
				name: 'imageSize',
				type: 'options',
				options: [
					{
						name: '1K (1024px)',
						value: '1K',
					},
					{
						name: '2K (2048px)',
						value: '2K',
					},
					{
						name: '4K (4096px)',
						value: '4K',
					},
				],
				default: '1K',
				description: 'Size of the generated image',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				// Get parameters
				const prompt = this.getNodeParameter('prompt', itemIndex) as string;
				const postId = this.getNodeParameter('postId', itemIndex) as string;
				const aspectRatio = this.getNodeParameter('aspectRatio', itemIndex) as string;
				const imageSize = this.getNodeParameter('imageSize', itemIndex) as string;

				console.log('[Gemini] Starting execution with prompt:', prompt.substring(0, 50));

				if (!prompt || prompt.trim() === '') {
					throw new NodeOperationError(this.getNode(), 'Prompt is required', { itemIndex });
				}

				if (!postId || postId.trim() === '') {
					throw new NodeOperationError(this.getNode(), 'Post ID is required', { itemIndex });
				}

				// Get Gemini credentials
				console.log('[Gemini] Getting Gemini credentials...');
				const geminiCredentials = await this.getCredentials('geminiApi');
				if (!geminiCredentials || !geminiCredentials.apiKey) {
					throw new NodeOperationError(this.getNode(), 'Gemini API credentials are required', { itemIndex });
				}

				// Get WordPress credentials
				console.log('[Gemini] Getting WordPress credentials...');
				const wordPressCredentials = await this.getCredentials('wordpressApi');
				if (!wordPressCredentials) {
					throw new NodeOperationError(this.getNode(), 'WordPress API credentials are required', { itemIndex });
				}
				console.log('[Gemini] WordPress URL:', wordPressCredentials.url);

				// Prepare request body for Gemini API
				const requestBody = {
					contents: [
						{
							role: 'user',
							parts: [
								{
									text: prompt,
								},
							],
						},
					],
					generationConfig: {
						responseModalities: ['IMAGE', 'TEXT'],
						imageConfig: {
							aspectRatio: aspectRatio,
							imageSize: imageSize,
						},
					},
				};

				// Call Gemini API
				const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:streamGenerateContent?key=${geminiCredentials.apiKey}`;

				console.log('[Gemini] Calling Gemini API...');
				let response;
				try {
					response = await this.helpers.request({
						method: 'POST',
						url: apiUrl,
						headers: {
							'Content-Type': 'application/json',
						},
						body: requestBody,
						json: true,
						timeout: 180000, // 3 minutes timeout
					});
					console.log('[Gemini] API call successful, response type:', Array.isArray(response) ? 'array' : 'object');
				} catch (error) {
					console.error('[Gemini] API call failed:', error.message);
					throw new NodeOperationError(
						this.getNode(),
						`Gemini API call failed: ${error.message}. Status: ${error.statusCode || 'unknown'}`,
						{ itemIndex }
					);
				}

				// Parse response (can be array of chunks or single object)
				console.log('[Gemini] Parsing response...');
				let candidates: any[] = [];
				if (Array.isArray(response)) {
					// Response is array of chunks
					console.log('[Gemini] Response is array with', response.length, 'chunks');
					for (const chunk of response) {
						if (chunk.candidates && Array.isArray(chunk.candidates)) {
							candidates.push(...chunk.candidates);
						}
					}
				} else if (response.candidates && Array.isArray(response.candidates)) {
					// Response is single object
					console.log('[Gemini] Response is single object');
					candidates = response.candidates;
				}

				console.log('[Gemini] Found', candidates.length, 'candidates');

				if (candidates.length === 0) {
					console.error('[Gemini] No candidates found. Response:', JSON.stringify(response).substring(0, 200));
					throw new NodeOperationError(
						this.getNode(),
						`No candidates found in Gemini API response. Response preview: ${JSON.stringify(response).substring(0, 500)}`,
						{ itemIndex }
					);
				}

				// Extract image data (check both camelCase and snake_case formats)
				console.log('[Gemini] Extracting image data...');
				let imageBase64: string | undefined;
				let mimeType: string = 'image/png';

				for (const candidate of candidates) {
					if (!candidate.content || !candidate.content.parts) continue;

					for (const part of candidate.content.parts) {
						// Check SDK format (camelCase)
						if (part.inlineData && part.inlineData.data) {
							imageBase64 = part.inlineData.data;
							mimeType = part.inlineData.mimeType || 'image/png';
							console.log('[Gemini] Found image data (camelCase format), size:', imageBase64.length);
							break;
						}
						// Check REST API format (snake_case)
						if (part.inline_data && part.inline_data.data) {
							imageBase64 = part.inline_data.data;
							mimeType = part.inline_data.mime_type || 'image/png';
							console.log('[Gemini] Found image data (snake_case format), size:', imageBase64.length);
							break;
						}
					}

					if (imageBase64) break;
				}

				if (!imageBase64) {
					console.error('[Gemini] No image data found in candidates');
					throw new NodeOperationError(
						this.getNode(),
						`No image data found in Gemini API response. Response preview: ${JSON.stringify(response).substring(0, 500)}`,
						{ itemIndex }
					);
				}

				// Convert base64 to Buffer
				console.log('[Gemini] Converting base64 to buffer...');
				const imageBuffer = Buffer.from(imageBase64, 'base64');
				console.log('[Gemini] Image buffer size:', imageBuffer.length, 'bytes');

				// Upload to WordPress
				const wordPressUrl = (wordPressCredentials.url as string).replace(/\/$/, ''); // Remove trailing slash
				const username = wordPressCredentials.username as string;
				const password = wordPressCredentials.password as string;
				const auth = Buffer.from(`${username}:${password}`).toString('base64');

				// Upload image to WordPress Media Library
				const timestamp = Date.now();
				const fileName = `featured-image-${timestamp}.png`;

				console.log('[WordPress] Uploading image to:', wordPressUrl);
				let uploadResponse;
				try {
					uploadResponse = await this.helpers.request({
						method: 'POST',
						url: `${wordPressUrl}/wp-json/wp/v2/media`,
						headers: {
							'Content-Disposition': `attachment; filename="${fileName}"`,
							'Content-Type': mimeType,
							'Authorization': `Basic ${auth}`,
						},
						body: imageBuffer,
						json: true,
					});
					console.log('[WordPress] Upload successful, media ID:', uploadResponse.id);
				} catch (error) {
					console.error('[WordPress] Upload failed:', error.message);
					throw new NodeOperationError(
						this.getNode(),
						`WordPress media upload failed: ${error.message}. Status: ${error.statusCode || 'unknown'}. URL: ${wordPressUrl}/wp-json/wp/v2/media`,
						{ itemIndex }
					);
				}

				const mediaId = uploadResponse.id;
				const mediaUrl = uploadResponse.source_url;

				if (!mediaId) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to get media ID from WordPress upload response. Response: ${JSON.stringify(uploadResponse).substring(0, 500)}`,
						{ itemIndex }
					);
				}

				// Set featured image for post
				console.log('[WordPress] Setting featured image for post:', postId);
				try {
					await this.helpers.request({
						method: 'POST',
						url: `${wordPressUrl}/wp-json/wp/v2/posts/${postId}`,
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Basic ${auth}`,
						},
						body: {
							featured_media: mediaId,
						},
						json: true,
					});
					console.log('[WordPress] Featured image set successfully');
				} catch (error) {
					console.error('[WordPress] Set featured image failed:', error.message);
					throw new NodeOperationError(
						this.getNode(),
						`WordPress set featured image failed: ${error.message}. Status: ${error.statusCode || 'unknown'}. Post ID: ${postId}`,
						{ itemIndex }
					);
				}

				console.log('[Gemini] Execution completed successfully');

				// Return success info
				returnData.push({
					json: {
						success: true,
						message: 'Image generated and set as featured image',
						wordpress: {
							mediaId: mediaId,
							mediaUrl: mediaUrl,
							postId: postId,
						},
						image: {
							mimeType: mimeType,
							fileSize: imageBuffer.length,
							fileName: fileName,
						},
						prompt: prompt,
						aspectRatio: aspectRatio,
						imageSize: imageSize,
					},
					pairedItem: itemIndex,
				});
			} catch (error) {
				console.error('[Gemini] Error during execution:', error.message);
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
							errorDetails: error.toString(),
						},
						pairedItem: itemIndex,
					});
					continue;
				}
				throw error;
			}
		}

		console.log('[Gemini] Returning', returnData.length, 'items');
		return [returnData];
	}
}
