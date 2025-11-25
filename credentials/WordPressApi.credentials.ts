import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class WordPressApi implements ICredentialType {
	name = 'wordPressApi';
	displayName = 'WordPress API';
	documentationUrl = 'https://developer.wordpress.org/rest-api/';
	properties: INodeProperties[] = [
		{
			displayName: 'WordPress URL',
			name: 'url',
			type: 'string',
			default: '',
			placeholder: 'https://example.com',
			required: true,
			description: 'The URL of your WordPress site (without trailing slash)',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description: 'WordPress username for authentication',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'WordPress Application Password or regular password. Application Passwords are recommended for better security.',
		},
	];
}
