/**
 * OAuth utilities for handling external service authentication
 */

export interface OAuthConfig {
	provider: string;
	workspaceId: string;
	redirectUri?: string;
}

export interface OAuthResult {
	success: boolean;
	error?: string;
	data?: unknown;
}

export interface OAuthError {
	code: string;
	message: string;
	retryable: boolean;
}

/**
 * Initiates OAuth flow for a given provider
 */
export async function initiateOAuth(config: OAuthConfig): Promise<OAuthResult> {
	try {
		const response = await fetch(`/api/integrations/${config.provider}/oauth`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				workspaceId: config.workspaceId,
				redirectUri: config.redirectUri,
			}),
		});

		if (!response.ok) {
			const errorData = await response.json();
			return {
				success: false,
				error: errorData.error || "Failed to initiate OAuth",
			};
		}

		const data = await response.json();

		// Redirect to OAuth provider
		if (data.authUrl) {
			window.location.href = data.authUrl;
			return { success: true };
		}

		return {
			success: false,
			error: "No authorization URL received",
		};
	} catch (error) {
		console.error("OAuth initiation error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Network error",
		};
	}
}

/**
 * Handles OAuth callback and processes the result
 */
export async function handleOAuthCallback(
	provider: string,
	searchParams: URLSearchParams,
): Promise<OAuthResult> {
	try {
		const code = searchParams.get("code");
		const state = searchParams.get("state");
		const error = searchParams.get("error");

		if (error) {
			const errorDescription = searchParams.get("error_description");
			return {
				success: false,
				error: errorDescription || error,
			};
		}

		if (!code || !state) {
			return {
				success: false,
				error: "Missing authorization code or state",
			};
		}

		// The callback endpoint will handle token exchange
		const response = await fetch(
			`/api/integrations/${provider}/oauth/callback?${searchParams.toString()}`,
		);

		if (!response.ok) {
			const errorData = await response.json();
			return {
				success: false,
				error: errorData.error || "OAuth callback failed",
			};
		}

		const data = await response.json();
		return {
			success: true,
			data,
		};
	} catch (error) {
		console.error("OAuth callback error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Network error",
		};
	}
}

/**
 * Retry mechanism with exponential backoff
 */
export class OAuthRetryManager {
	private retryCount = 0;
	private maxRetries = 3;
	private baseDelay = 1000; // 1 second

	async retry<T>(operation: () => Promise<T>): Promise<T> {
		try {
			const result = await operation();
			this.retryCount = 0; // Reset on success
			return result;
		} catch (error) {
			if (this.retryCount >= this.maxRetries) {
				throw error;
			}

			const delay = this.baseDelay * 2 ** this.retryCount;
			this.retryCount++;

			console.log(
				`Retrying operation in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`,
			);

			await new Promise((resolve) => setTimeout(resolve, delay));
			return this.retry(operation);
		}
	}

	reset() {
		this.retryCount = 0;
	}
}

/**
 * OAuth error classification
 */
export function classifyOAuthError(error: string): OAuthError {
	const errorLower = error.toLowerCase();

	if (
		errorLower.includes("access_denied") ||
		errorLower.includes("authorization_denied")
	) {
		return {
			code: "ACCESS_DENIED",
			message: "Please grant access to your account to continue.",
			retryable: true,
		};
	}

	if (errorLower.includes("invalid_scope")) {
		return {
			code: "INVALID_SCOPE",
			message: "The app needs permission to read and write your data.",
			retryable: true,
		};
	}

	if (errorLower.includes("network") || errorLower.includes("timeout")) {
		return {
			code: "NETWORK_ERROR",
			message: "Unable to connect. Please check your internet connection.",
			retryable: true,
		};
	}

	if (errorLower.includes("rate limit")) {
		return {
			code: "RATE_LIMITED",
			message: "Too many requests. Please try again later.",
			retryable: true,
		};
	}

	if (errorLower.includes("token") && errorLower.includes("expired")) {
		return {
			code: "TOKEN_EXPIRED",
			message: "Your session has expired. Please reconnect.",
			retryable: true,
		};
	}

	return {
		code: "UNKNOWN_ERROR",
		message: error || "An unexpected error occurred.",
		retryable: false,
	};
}

/**
 * Secure token storage utilities
 */
const TOKEN_KEY = "oauth_tokens";

export function storeTokens(provider: string, tokens: Record<string, unknown>) {
	try {
		const stored = getAllTokens();
		stored[provider] = {
			...tokens,
			timestamp: Date.now(),
		};

		// Use sessionStorage for security (cleared when tab closes)
		sessionStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
	} catch (error) {
		console.error("Failed to store tokens:", error);
	}
}

export function retrieveTokens(
	provider: string,
): Record<string, unknown> | null {
	try {
		const stored = getAllTokens();
		const tokens = stored[provider] as Record<string, unknown> & {
			timestamp?: number;
		};

		if (!tokens) return null;

		// Check if tokens are expired (1 hour default)
		if (tokens.timestamp) {
			const age = Date.now() - tokens.timestamp;
			if (age > 3600000) {
				// 1 hour
				removeTokens(provider);
				return null;
			}
		}

		return tokens;
	} catch (error) {
		console.error("Failed to retrieve tokens:", error);
		return null;
	}
}

export function removeTokens(provider: string) {
	try {
		const stored = getAllTokens();
		delete stored[provider];
		sessionStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
	} catch (error) {
		console.error("Failed to remove tokens:", error);
	}
}

export function clearAllTokens() {
	try {
		sessionStorage.removeItem(TOKEN_KEY);
	} catch (error) {
		console.error("Failed to clear tokens:", error);
	}
}

function getAllTokens(): Record<
	string,
	Record<string, unknown> & { timestamp?: number }
> {
	try {
		const stored = sessionStorage.getItem(TOKEN_KEY);
		return stored ? JSON.parse(stored) : {};
	} catch (error) {
		console.error("Failed to parse stored tokens:", error);
		return {};
	}
}
