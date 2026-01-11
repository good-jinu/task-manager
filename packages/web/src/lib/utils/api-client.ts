/**
 * Enhanced API client with network resilience and retry logic
 * Provides a consistent interface for making API calls with automatic retry and offline support
 */

import { handleApiError } from "./error-handling";
import {
	resilientFetch,
	resilientOAuthOperation,
	resilientSyncOperation,
} from "./network-resilience";

export interface ApiClientOptions {
	baseUrl?: string;
	defaultHeaders?: Record<string, string>;
	timeout?: number;
}

export interface ApiRequestOptions extends RequestInit {
	timeout?: number;
	retryType?: "api_call" | "sync" | "oauth" | "database_query";
	context?: Record<string, unknown>;
}

/**
 * Enhanced API client class with network resilience
 */
export class ApiClient {
	private baseUrl: string;
	private defaultHeaders: Record<string, string>;
	private timeout: number;

	constructor(options: ApiClientOptions = {}) {
		this.baseUrl = options.baseUrl || "";
		this.defaultHeaders = options.defaultHeaders || {};
		this.timeout = options.timeout || 30000; // 30 seconds default
	}

	/**
	 * Make a resilient API request
	 */
	async request<T = unknown>(
		url: string,
		options: ApiRequestOptions = {},
	): Promise<T> {
		const {
			timeout = this.timeout,
			retryType = "api_call",
			context = {},
			...fetchOptions
		} = options;

		const fullUrl = url.startsWith("http") ? url : `${this.baseUrl}${url}`;

		const requestOptions: RequestInit = {
			...fetchOptions,
			headers: {
				...this.defaultHeaders,
				...fetchOptions.headers,
			},
			signal: AbortSignal.timeout(timeout),
		};

		try {
			const response = await resilientFetch(fullUrl, requestOptions, retryType);

			// Handle different content types
			const contentType = response.headers.get("content-type");
			if (contentType?.includes("application/json")) {
				return await response.json();
			} else if (contentType?.includes("text/")) {
				return (await response.text()) as T;
			} else {
				return response as T;
			}
		} catch (error) {
			// Handle and track the error
			const errorId = handleApiError(error, {
				...context,
				url: fullUrl,
				method: requestOptions.method || "GET",
				retryType,
			});

			// Re-throw with error ID for tracking
			const enhancedError =
				error instanceof Error ? error : new Error(String(error));
			(enhancedError as any).errorId = errorId;
			throw enhancedError;
		}
	}

	/**
	 * GET request with resilience
	 */
	async get<T = unknown>(
		url: string,
		options: Omit<ApiRequestOptions, "method"> = {},
	): Promise<T> {
		return this.request<T>(url, { ...options, method: "GET" });
	}

	/**
	 * POST request with resilience
	 */
	async post<T = unknown>(
		url: string,
		data?: unknown,
		options: Omit<ApiRequestOptions, "method" | "body"> = {},
	): Promise<T> {
		return this.request<T>(url, {
			...options,
			method: "POST",
			body: data ? JSON.stringify(data) : undefined,
			headers: {
				"Content-Type": "application/json",
				...options.headers,
			},
		});
	}

	/**
	 * PUT request with resilience
	 */
	async put<T = unknown>(
		url: string,
		data?: unknown,
		options: Omit<ApiRequestOptions, "method" | "body"> = {},
	): Promise<T> {
		return this.request<T>(url, {
			...options,
			method: "PUT",
			body: data ? JSON.stringify(data) : undefined,
			headers: {
				"Content-Type": "application/json",
				...options.headers,
			},
		});
	}

	/**
	 * DELETE request with resilience
	 */
	async delete<T = unknown>(
		url: string,
		options: Omit<ApiRequestOptions, "method"> = {},
	): Promise<T> {
		return this.request<T>(url, { ...options, method: "DELETE" });
	}

	/**
	 * PATCH request with resilience
	 */
	async patch<T = unknown>(
		url: string,
		data?: unknown,
		options: Omit<ApiRequestOptions, "method" | "body"> = {},
	): Promise<T> {
		return this.request<T>(url, {
			...options,
			method: "PATCH",
			body: data ? JSON.stringify(data) : undefined,
			headers: {
				"Content-Type": "application/json",
				...options.headers,
			},
		});
	}
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient({
	defaultHeaders: {
		Accept: "application/json",
	},
});

/**
 * Specialized API client for sync operations
 */
export class SyncApiClient extends ApiClient {
	/**
	 * Trigger a manual sync with resilience
	 */
	async triggerSync(
		integrationId: string,
		options: {
			force?: boolean;
			immediate?: boolean;
			syncType?: "full" | "incremental";
		} = {},
	): Promise<any> {
		return resilientSyncOperation(
			async () => {
				return this.put(`/api/integrations/${integrationId}/sync`, options, {
					retryType: "sync",
					context: {
						integrationId,
						syncType: options.syncType || "full",
						manual: true,
					},
				});
			},
			integrationId,
			"manual",
		);
	}

	/**
	 * Get sync status with resilience
	 */
	async getSyncStatus(integrationId: string): Promise<any> {
		return this.get(`/api/integrations/${integrationId}/sync`, {
			retryType: "sync",
			context: {
				integrationId,
				operation: "status",
			},
		});
	}

	/**
	 * Get sync statistics with resilience
	 */
	async getSyncStatistics(integrationId: string): Promise<any> {
		return this.get(`/api/integrations/${integrationId}/sync/statistics`, {
			retryType: "sync",
			context: {
				integrationId,
				operation: "statistics",
			},
		});
	}
}

/**
 * Specialized API client for OAuth operations
 */
export class OAuthApiClient extends ApiClient {
	/**
	 * Refresh OAuth token with resilience
	 */
	async refreshToken(provider: string = "notion"): Promise<any> {
		return resilientOAuthOperation(async () => {
			return this.post(
				`/api/integrations/${provider}/oauth/refresh`,
				undefined,
				{
					retryType: "oauth",
					context: {
						provider,
						operation: "refresh",
					},
				},
			);
		}, provider);
	}

	/**
	 * Check token status with resilience
	 */
	async checkTokenStatus(provider: string = "notion"): Promise<any> {
		return this.get(`/api/integrations/${provider}/oauth/refresh`, {
			retryType: "oauth",
			context: {
				provider,
				operation: "status",
			},
		});
	}
}

/**
 * Default specialized client instances
 */
export const syncApiClient = new SyncApiClient();
export const oauthApiClient = new OAuthApiClient();

/**
 * Utility function to create a custom API client with specific configuration
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
	return new ApiClient(options);
}

/**
 * Utility function to handle common API error scenarios
 */
export function isNetworkError(error: unknown): boolean {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes("network") ||
			message.includes("fetch") ||
			message.includes("connection") ||
			message.includes("timeout") ||
			message.includes("offline")
		);
	}
	return false;
}

/**
 * Utility function to check if an error is retryable
 */
export function isRetryableApiError(error: unknown): boolean {
	if (error instanceof Response) {
		// HTTP errors that are retryable
		return error.status >= 500 || error.status === 429 || error.status === 408;
	}

	return isNetworkError(error);
}
