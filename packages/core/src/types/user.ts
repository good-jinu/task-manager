/**
 * User model for database storage and shared across packages
 */
export interface User {
	id: string; // Primary key (UUID)
	notionUserId: string; // Notion user ID from OAuth
	email: string; // User email from Notion
	name: string; // Display name
	avatarUrl?: string; // Profile picture URL
	notionAccessToken: string; // Notion access token for API calls
	notionRefreshToken?: string; // Notion refresh token for token renewal
	tokenExpiresAt?: string; // When the access token expires (ISO string)
	createdAt: string; // Account creation timestamp (ISO string)
	updatedAt: string; // Last update timestamp (ISO string)
}

/**
 * Input types for creating new users
 */
export interface CreateUserInput {
	notionUserId: string;
	email: string;
	name: string;
	avatarUrl?: string;
	notionAccessToken: string;
	notionRefreshToken?: string;
	tokenExpiresAt?: string;
}

/**
 * Input types for updating existing users
 */
export interface UpdateUserInput {
	email?: string;
	name?: string;
	avatarUrl?: string;
	notionAccessToken?: string;
	notionRefreshToken?: string;
	tokenExpiresAt?: string;
}
