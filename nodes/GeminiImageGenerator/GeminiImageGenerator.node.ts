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
		version: 8,
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

				if (!prompt || prompt.trim() === '') {
					throw new NodeOperationError(this.getNode(), 'Prompt is required', { itemIndex });
				}

				if (!postId || postId.trim() === '') {
					throw new NodeOperationError(this.getNode(), 'Post ID is required', { itemIndex });
				}

				// Get Gemini credentials
				const geminiCredentials = await this.getCredentials('geminiApi');
				if (!geminiCredentials || !geminiCredentials.apiKey) {
					throw new NodeOperationError(this.getNode(), 'Gemini API credentials are required', { itemIndex });
				}

				// Get WordPress credentials
				const wordPressCredentials = await this.getCredentials('wordpressApi');
				if (!wordPressCredentials) {
					throw new NodeOperationError(this.getNode(), 'WordPress API credentials are required', { itemIndex });
				}

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

				const response = await this.helpers.request({
					method: 'POST',
					url: apiUrl,
					headers: {
						'Content-Type': 'application/json',
					},
					body: requestBody,
					json: true,
				});

				// Parse response (can be array of chunks or single object)
				let candidates: any[] = [];
				if (Array.isArray(response)) {
					// Response is array of chunks
					for (const chunk of response) {
						if (chunk.candidates && Array.isArray(chunk.candidates)) {
							candidates.push(...chunk.candidates);
						}
					}
				} else if (response.candidates && Array.isArray(response.candidates)) {
					// Response is single object
					candidates = response.candidates;
				}

				if (candidates.length === 0) {
					throw new NodeOperationError(
						this.getNode(),
						`No candidates found in Gemini API response. Response preview: ${JSON.stringify(response).substring(0, 500)}`,
						{ itemIndex }
					);
				}

				// Extract image data (check both camelCase and snake_case formats)
				let imageBase64: string | undefined;
				let mimeType: string = 'image/png';

				for (const candidate of candidates) {
					if (!candidate.content || !candidate.content.parts) continue;

					for (const part of candidate.content.parts) {
						// Check SDK format (camelCase)
						if (part.inlineData && part.inlineData.data) {
							imageBase64 = part.inlineData.data;
							mimeType = part.inlineData.mimeType || 'image/png';
							break;
						}
						// Check REST API format (snake_case)
						if (part.inline_data && part.inline_data.data) {
							imageBase64 = part.inline_data.data;
							mimeType = part.inline_data.mime_type || 'image/png';
							break;
						}
					}

					if (imageBase64) break;
				}

				if (!imageBase64) {
					throw new NodeOperationError(
						this.getNode(),
						`No image data found in Gemini API response. Response preview: ${JSON.stringify(response).substring(0, 500)}`,
						{ itemIndex }
					);
				}

				// Convert base64 to Buffer
				const imageBuffer = Buffer.from(imageBase64, 'base64');

				// Upload to WordPress
				const wordPressUrl = (wordPressCredentials.url as string).replace(/\/$/, ''); // Remove trailing slash
				const username = wordPressCredentials.username as string;
				const password = wordPressCredentials.password as string;
				const auth = Buffer.from(`${username}:${password}`).toString('base64');

				// Upload image to WordPress Media Library
				const timestamp = Date.now();
				const fileName = `featured-image-${timestamp}.png`;

				const uploadResponse = await this.helpers.request({
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
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
						},
						pairedItem: itemIndex,
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
