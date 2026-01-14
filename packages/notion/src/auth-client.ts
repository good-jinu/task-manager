import { Client } from "@notionhq/client";
import type { User } from "@task-manager/db";

export type TokenRefreshCallback = (
	userId: string,
	newAccessToken: string,
	newRefreshToken?: string,
	expiresAt?: string,
) => Promise<void>;

export interface NotionAuthConfig {
	clientId: string;
	clientSecret: string;
	onTokenRefresh?: TokenRefreshCallback;
}

/**
 * Enhanced Notion client that automatically handles token refresh
 */
export class NotionAuthClient {
	private client: Client;
	private user: User;
	private config: NotionAuthConfig;
	private isRefreshing = false;
	private refreshPromise: Promise<string> | null = null;

	constructor(user: User, config: NotionAuthConfig) {
		this.user = user;
		this.config = config;
		this.client = new Client({
			auth: user.notionAccessToken,
		});
	}

	/**
	 * Get the underlying Notion client with automatic token refresh
	 */
	async getClient(): Promise<Client> {
		// Check if token is expired or will expire soon (5 minute buffer)
		if (this.isTokenExpired()) {
			const newToken = await this.ensureValidToken();
			// Update client with new token
			this.client = new Client({
				auth: newToken,
			});
		}
		return this.client;
	}

	/**
	 * Check if the current token is expired or will expire soon
	 */
	private isTokenExpired(bufferMinutes: number = 5): boolean {
		if (!this.user.tokenExpiresAt) {
			// If no expiration time, assume it might be expired
			return true;
		}

		const now = new Date();
		// Handle both string and Date formats
		const expirationDate =
			typeof this.user.tokenExpiresAt === "string"
				? new Date(this.user.tokenExpiresAt)
				: this.user.tokenExpiresAt;

		const expirationWithBuffer = new Date(
			expirationDate.getTime() - bufferMinutes * 60 * 1000,
		);

		return now >= expirationWithBuffer;
	}

	/**
	 * Ensure we have a valid access token, refreshing if necessary
	 */
	private async ensureValidToken(): Promise<string> {
		if (!this.isTokenExpired()) {
			return this.user.notionAccessToken;
		}

		// If already refreshing, wait for that to complete
		if (this.isRefreshing && this.refreshPromise) {
			return await this.refreshPromise;
		}

		// Start refresh process
		this.isRefreshing = true;
		this.refreshPromise = this.refreshToken();

		try {
			const newToken = await this.refreshPromise;
			return newToken;
		} finally {
			this.isRefreshing = false;
			this.refreshPromise = null;
		}
	}

	/**
	 * Refresh the access token using the refresh token
	 */
	private async refreshToken(): Promise<string> {
		if (!this.user.notionRefreshToken) {
			throw new Error("No refresh token available for user");
		}

		try {
			// Make request to Notion's token refresh endpoint
			const response = await fetch("https://api.notion.com/v1/oauth/token", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64")}`,
				},
				body: JSON.stringify({
					grant_type: "refresh_token",
					refresh_token: this.user.notionRefreshToken,
				}),
			});

			if (!response.ok) {
				const errorData = await response.text();
				throw new Error(
					`Token refresh failed: ${response.status} ${errorData}`,
				);
			}

			const tokenData = await response.json();

			// Calculate new expiration time
			const tokenExpiresAt = tokenData.expires_in
				? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
				: new Date(Date.now() + 3600 * 1000).toISOString(); // Default 1 hour

			// Update user object
			this.user.notionAccessToken = tokenData.access_token;
			if (tokenData.refresh_token) {
				this.user.notionRefreshToken = tokenData.refresh_token;
			}
			this.user.tokenExpiresAt = tokenExpiresAt;

			// Call the callback to update the database
			if (this.config.onTokenRefresh) {
				await this.config.onTokenRefresh(
					this.user.id,
					tokenData.access_token,
					tokenData.refresh_token,
					tokenExpiresAt,
				);
			}

			console.log(`Token refreshed successfully for user: ${this.user.id}`);
			return tokenData.access_token;
		} catch (error) {
			console.error(`Failed to refresh token for user ${this.user.id}:`, error);
			throw new Error(
				`Token refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Get current user info
	 */
	getUser(): User {
		return this.user;
	}

	/**
	 * Update user data (useful when user data changes externally)
	 */
	updateUser(user: User): void {
		this.user = user;
		// Update client if token changed
		this.client = new Client({
			auth: user.notionAccessToken,
		});
	}
}
