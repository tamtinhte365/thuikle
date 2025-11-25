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
		version: 5,
		description: 'Generate images using Google Gemini API and optionally upload to WordPress',
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
				name: 'wordPressApi',
				required: true,
				displayOptions: {
					show: {
						enableWordPressUpload: [true],
					},
				},
			},
		],
		properties: [
			// CRITICAL: This MUST be the first property for displayOptions to work correctly
			{
				displayName: 'Enable WordPress Upload',
				name: 'enableWordPressUpload',
				type: 'boolean',
				default: false,
				description: 'Whether to automatically upload the generated image to WordPress and set it as featured image for a post',
			},
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
			// WordPress-specific fields (only shown when toggle is ON)
			{
				displayName: 'Post ID',
				name: 'postId',
				type: 'string',
				default: '={{ $json.id }}',
				required: true,
				displayOptions: {
					show: {
						enableWordPressUpload: [true],
					},
				},
				description: 'WordPress post ID to set the featured image for. Use expressions like {{ $json.id }}.',
			},
			// Output format fields (only shown when toggle is OFF)
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				options: [
					{
						name: 'Binary (for Upload)',
						value: 'binary',
						description: 'Returns binary data suitable for file upload operations',
					},
					{
						name: 'Base64 String',
						value: 'base64',
						description: 'Returns base64 encoded string in JSON',
					},
					{
						name: 'JSON (Debug)',
						value: 'json',
						description: 'Returns full API response for debugging',
					},
				],
				default: 'binary',
				displayOptions: {
					show: {
						enableWordPressUpload: [false],
					},
				},
				description: 'Format for the output data',
			},
			{
				displayName: 'Binary Property Name',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: {
					show: {
						enableWordPressUpload: [false],
						outputFormat: ['binary'],
					},
				},
				description: 'Name of the binary property to store the image data in',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				// Get parameters
				const enableWordPressUpload = this.getNodeParameter('enableWordPressUpload', itemIndex, false) as boolean;
				const prompt = this.getNodeParameter('prompt', itemIndex) as string;
				const aspectRatio = this.getNodeParameter('aspectRatio', itemIndex) as string;
				const imageSize = this.getNodeParameter('imageSize', itemIndex) as string;

				if (!prompt || prompt.trim() === '') {
					throw new NodeOperationError(this.getNode(), 'Prompt is required', { itemIndex });
				}

				// Get Gemini credentials
				const geminiCredentials = await this.getCredentials('geminiApi');
				if (!geminiCredentials || !geminiCredentials.apiKey) {
					throw new NodeOperationError(this.getNode(), 'Gemini API credentials are required', { itemIndex });
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

				// Handle WordPress upload if enabled
				if (enableWordPressUpload) {
					// Get WordPress credentials
					const wordPressCredentials = await this.getCredentials('wordPressApi');
					if (!wordPressCredentials) {
						throw new NodeOperationError(this.getNode(), 'WordPress API credentials are required when WordPress upload is enabled', { itemIndex });
					}

					const postId = this.getNodeParameter('postId', itemIndex) as string;
					if (!postId) {
						throw new NodeOperationError(this.getNode(), 'Post ID is required when WordPress upload is enabled', { itemIndex });
					}

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
						},
						pairedItem: itemIndex,
					});
				} else {
					// Return image in requested format
					const outputFormat = this.getNodeParameter('outputFormat', itemIndex, 'binary') as string;

					if (outputFormat === 'binary') {
						const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex, 'data') as string;
						const binaryData = await this.helpers.prepareBinaryData(
							imageBuffer,
							`generated-image-${Date.now()}.png`,
							mimeType
						);

						returnData.push({
							json: {},
							binary: {
								[binaryPropertyName]: binaryData,
							},
							pairedItem: itemIndex,
						});
					} else if (outputFormat === 'base64') {
						returnData.push({
							json: {
								imageBase64: imageBase64,
								mimeType: mimeType,
								fileSize: imageBuffer.length,
							},
							pairedItem: itemIndex,
						});
					} else if (outputFormat === 'json') {
						// Debug mode - return full response
						returnData.push({
							json: {
								response: response,
								extractedImage: {
									mimeType: mimeType,
									base64Length: imageBase64.length,
								},
							},
							pairedItem: itemIndex,
						});
					}
				}
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
