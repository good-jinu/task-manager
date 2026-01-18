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
		console.log("[NotionAuthClient.getClient] Getting client:", {
			userId: this.user.id,
			hasRefreshToken: !!this.user.notionRefreshToken,
			tokenExpiresAt: this.user.tokenExpiresAt,
		});

		// Check if token is expired or will expire soon (5 minute buffer)
		if (this.isTokenExpired()) {
			console.log(
				"[NotionAuthClient.getClient] Token expired or expiring soon, refreshing",
			);
			const newToken = await this.ensureValidToken();
			// Update client with new token
			this.client = new Client({
				auth: newToken,
			});
			console.log("[NotionAuthClient.getClient] Client updated with new token");
		} else {
			console.log(
				"[NotionAuthClient.getClient] Token still valid, using existing client",
			);
		}
		return this.client;
	}

	/**
	 * Check if the current token is expired or will expire soon
	 */
	private isTokenExpired(bufferMinutes: number = 5): boolean {
		if (!this.user.tokenExpiresAt) {
			console.log(
				"[NotionAuthClient.isTokenExpired] No expiration time set, assuming expired",
			);
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

		const isExpired = now >= expirationWithBuffer;
		console.log("[NotionAuthClient.isTokenExpired] Token expiration check:", {
			now: now.toISOString(),
			expiresAt: expirationDate.toISOString(),
			bufferMinutes,
			isExpired,
		});

		return isExpired;
	}

	/**
	 * Ensure we have a valid access token, refreshing if necessary
	 */
	private async ensureValidToken(): Promise<string> {
		if (!this.isTokenExpired()) {
			console.log(
				"[NotionAuthClient.ensureValidToken] Token still valid, no refresh needed",
			);
			return this.user.notionAccessToken;
		}

		// If already refreshing, wait for that to complete
		if (this.isRefreshing && this.refreshPromise) {
			console.log(
				"[NotionAuthClient.ensureValidToken] Refresh already in progress, waiting",
			);
			return await this.refreshPromise;
		}

		// Start refresh process
		console.log("[NotionAuthClient.ensureValidToken] Starting token refresh");
		this.isRefreshing = true;
		this.refreshPromise = this.refreshToken();

		try {
			const newToken = await this.refreshPromise;
			console.log(
				"[NotionAuthClient.ensureValidToken] Token refresh completed successfully",
			);
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
		console.log("[NotionAuthClient.refreshToken] Starting token refresh:", {
			userId: this.user.id,
			hasRefreshToken: !!this.user.notionRefreshToken,
		});

		if (!this.user.notionRefreshToken) {
			console.error(
				"[NotionAuthClient.refreshToken] No refresh token available",
			);
			throw new Error("No refresh token available for user");
		}

		try {
			console.log(
				"[NotionAuthClient.refreshToken] Making request to Notion token endpoint",
			);
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
				console.error("[NotionAuthClient.refreshToken] Token refresh failed:", {
					status: response.status,
					error: errorData,
				});
				throw new Error(
					`Token refresh failed: ${response.status} ${errorData}`,
				);
			}

			const tokenData = await response.json();
			console.log("[NotionAuthClient.refreshToken] Token response received:", {
				hasAccessToken: !!tokenData.access_token,
				hasRefreshToken: !!tokenData.refresh_token,
				expiresIn: tokenData.expires_in,
			});

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
				console.log(
					"[NotionAuthClient.refreshToken] Calling onTokenRefresh callback",
				);
				await this.config.onTokenRefresh(
					this.user.id,
					tokenData.access_token,
					tokenData.refresh_token,
					tokenExpiresAt,
				);
				console.log(
					"[NotionAuthClient.refreshToken] Database updated with new tokens",
				);
			}

			console.log(
				`[NotionAuthClient.refreshToken] Token refreshed successfully for user: ${this.user.id}`,
			);
			return tokenData.access_token;
		} catch (error) {
			console.error(
				`[NotionAuthClient.refreshToken] Failed to refresh token for user ${this.user.id}:`,
				error,
			);
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
