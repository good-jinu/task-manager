/**
 * User model for DynamoDB storage
 */
export interface User {
	id: string; // Primary key (UUID)
	notionUserId: string; // Notion user ID from OAuth
	email: string; // User email from Notion
	name: string; // Display name
	avatarUrl?: string; // Profile picture URL
	notionAccessToken: string; // Notion access token for API calls
	notionRefreshToken?: string; // Notion refresh token for token renewal
	tokenExpiresAt?: Date; // When the access token expires
	createdAt: Date; // Account creation timestamp
	updatedAt: Date; // Last update timestamp
}

/**
 * Input types for creating new records
 */
export interface CreateUserInput {
	notionUserId: string;
	email: string;
	name: string;
	avatarUrl?: string;
	notionAccessToken: string;
	notionRefreshToken?: string;
	tokenExpiresAt?: Date;
}

/**
 * Input types for updating existing records
 */
export interface UpdateUserInput {
	email?: string;
	name?: string;
	avatarUrl?: string;
	notionAccessToken?: string;
	notionRefreshToken?: string;
	tokenExpiresAt?: Date;
}
