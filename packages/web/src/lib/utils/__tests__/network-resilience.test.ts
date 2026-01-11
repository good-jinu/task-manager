/**
 * Tests for network resilience and retry logic
 * Validates offline detection, queue management, exponential backoff, and automatic retry
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorStateManager } from "../error-handling";
import {
	getNetworkStatusIndicator,
	NetworkResilienceManager,
	networkResilienceManager,
	resilientFetch,
	resilientOAuthOperation,
	resilientSyncOperation,
	withRetry,
} from "../network-resilience";

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock navigator and window for testing
Object.defineProperty(global, "navigator", {
	value: { onLine: true },
	writable: true,
});

Object.defineProperty(global, "window", {
	value: {
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		setInterval: vi.fn(() => 1),
		clearInterval: vi.fn(),
		location: {
			href: "http://localhost:3000/test",
		},
	},
	writable: true,
});

// Mock sessionStorage
Object.defineProperty(global, "sessionStorage", {
	value: {
		getItem: vi.fn(),
		setItem: vi.fn(),
		removeItem: vi.fn(),
		clear: vi.fn(),
	},
	writable: true,
});

describe("NetworkResilienceManager", () => {
	let manager: NetworkResilienceManager;

	beforeEach(() => {
		vi.clearAllMocks();
		manager = new NetworkResilienceManager();
		errorStateManager.clearErrors();
	});

	afterEach(() => {
		manager.destroy();
	});

	describe("Network Status Detection", () => {
		it("should initialize with online status when navigator.onLine is true", () => {
			// The manager initializes based on navigator.onLine
			expect(manager.getNetworkStatus()).toBe("online");
		});

		it("should detect online status from navigator", () => {
			// Simulate online status
			(global.navigator as any).onLine = true;
			const newManager = new NetworkResilienceManager();

			// Should detect online status
			expect(newManager.getNetworkStatus()).toBe("online");
			newManager.destroy();
		});

		it("should detect offline status from navigator", () => {
			// Simulate offline status
			(global.navigator as any).onLine = false;
			const newManager = new NetworkResilienceManager();

			// Should detect offline status
			expect(newManager.getNetworkStatus()).toBe("offline");
			newManager.destroy();
		});
	});

	describe("Operation Queuing", () => {
		it("should queue operations when offline", () => {
			const operation = vi.fn().mockResolvedValue("success");

			// Set offline status
			(manager as any).updateNetworkStatus("offline");

			const operationId = manager.queueOperation("sync", operation);

			expect(operationId).toBeDefined();
			expect(manager.getQueuedOperations()).toHaveLength(1);
			expect(operation).not.toHaveBeenCalled();
		});

		it("should execute operations immediately when online", async () => {
			const operation = vi.fn().mockResolvedValue("success");

			// Set online status
			(manager as any).updateNetworkStatus("online");

			manager.queueOperation("sync", operation);

			// Give time for async execution
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(operation).toHaveBeenCalled();
		});

		it("should respect queue size limits", () => {
			// Set offline status
			(manager as any).updateNetworkStatus("offline");

			// Fill queue beyond limit
			for (let i = 0; i < 105; i++) {
				try {
					manager.queueOperation("api_call", vi.fn(), {}, i < 50 ? 1 : 0);
				} catch (error) {
					// Should throw when queue is full
					expect(error).toBeInstanceOf(Error);
					expect((error as Error).message).toContain("queue is full");
				}
			}
		});

		it("should prioritize high-priority operations", () => {
			// Set offline status
			(manager as any).updateNetworkStatus("offline");

			manager.queueOperation("sync", vi.fn(), {}, 0); // Low priority
			manager.queueOperation("oauth", vi.fn(), {}, 10); // High priority
			manager.queueOperation("api_call", vi.fn(), {}, 5); // Medium priority

			const operations = manager.getQueuedOperations();
			expect(operations[0].priority).toBe(10);
			expect(operations[1].priority).toBe(5);
			expect(operations[2].priority).toBe(0);
		});
	});

	describe("Retry Logic", () => {
		it("should implement exponential backoff", () => {
			const config = (manager as any).retryConfigs.sync;

			const delay1 = (manager as any).calculateRetryDelay(1, config);
			const delay2 = (manager as any).calculateRetryDelay(2, config);
			const delay3 = (manager as any).calculateRetryDelay(3, config);

			expect(delay2).toBeGreaterThan(delay1);
			expect(delay3).toBeGreaterThan(delay2);
		});

		it("should respect maximum delay", () => {
			const config = (manager as any).retryConfigs.sync;

			const delay = (manager as any).calculateRetryDelay(10, config);

			expect(delay).toBeLessThanOrEqual(config.maxDelay);
		});

		it("should add jitter when configured", () => {
			const config = { ...(manager as any).retryConfigs.sync, jitter: true };

			const delay1 = (manager as any).calculateRetryDelay(1, config);
			const delay2 = (manager as any).calculateRetryDelay(1, config);

			// With jitter, delays should be different
			expect(delay1).not.toBe(delay2);
		});

		it("should not add jitter when disabled", () => {
			const config = { ...(manager as any).retryConfigs.sync, jitter: false };

			const delay1 = (manager as any).calculateRetryDelay(1, config);
			const delay2 = (manager as any).calculateRetryDelay(1, config);

			// Without jitter, delays should be the same
			expect(delay1).toBe(delay2);
		});
	});

	describe("Error Handling", () => {
		it("should remove operations after max retries", async () => {
			const operation = vi.fn().mockRejectedValue(new Error("Test error"));

			// Set online status
			(manager as any).updateNetworkStatus("online");

			const operationId = manager.queueOperation("api_call", operation);

			// Wait for retries to complete
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Operation should be removed after max retries
			expect(manager.getQueuedOperations()).toHaveLength(0);
		});

		it("should add error to error state manager on failure", async () => {
			const operation = vi.fn().mockRejectedValue(new Error("Test error"));

			// Set online status
			(manager as any).updateNetworkStatus("online");

			manager.queueOperation("sync", operation);

			// Wait for operation to fail
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should have added an error
			const errors = errorStateManager.getErrors();
			expect(errors.length).toBeGreaterThan(0);
		});
	});
});

describe("Utility Functions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		errorStateManager.clearErrors();
		networkResilienceManager.clearQueue();
	});

	describe("withRetry", () => {
		it("should execute operation immediately if successful", async () => {
			const operation = vi.fn().mockResolvedValue("success");

			const result = await withRetry(operation);

			expect(result).toBe("success");
			expect(operation).toHaveBeenCalledTimes(1);
		});

		it("should queue operation if network is offline", async () => {
			const operation = vi.fn().mockResolvedValue("success");

			// Set offline status
			(networkResilienceManager as any).updateNetworkStatus("offline");

			// This should queue the operation
			const promise = withRetry(operation);

			// Operation should be queued
			expect(networkResilienceManager.getQueuedOperations()).toHaveLength(1);

			// Bring network back online
			(networkResilienceManager as any).updateNetworkStatus("online");

			// Wait for operation to complete
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(operation).toHaveBeenCalled();
		});

		it("should queue operation if error is retryable", async () => {
			const operation = vi
				.fn()
				.mockRejectedValueOnce(new Error("network error"))
				.mockResolvedValue("success");

			const result = await withRetry(operation);

			expect(result).toBe("success");
			expect(operation).toHaveBeenCalledTimes(2);
		});
	});

	describe("resilientFetch", () => {
		it("should make successful requests", async () => {
			const mockResponse = new Response("success", { status: 200 });
			mockFetch.mockResolvedValue(mockResponse);

			const response = await resilientFetch("/api/test");

			expect(response).toBe(mockResponse);
			expect(mockFetch).toHaveBeenCalledWith("/api/test", undefined);
		});

		it("should throw on non-ok responses", async () => {
			const mockResponse = new Response("error", { status: 500 });
			mockFetch.mockResolvedValue(mockResponse);

			await expect(resilientFetch("/api/test")).rejects.toBe(mockResponse);
		});

		it("should include request context", async () => {
			const mockResponse = new Response("success", { status: 200 });
			mockFetch.mockResolvedValue(mockResponse);

			await resilientFetch("/api/test", { method: "POST" });

			expect(mockFetch).toHaveBeenCalledWith("/api/test", { method: "POST" });
		});
	});

	describe("resilientSyncOperation", () => {
		it("should execute sync operations with proper context", async () => {
			const operation = vi.fn().mockResolvedValue("sync success");

			const result = await resilientSyncOperation(operation, "integration-123");

			expect(result).toBe("sync success");
			expect(operation).toHaveBeenCalled();
		});

		it("should queue sync operations when offline", async () => {
			const operation = vi.fn().mockResolvedValue("sync success");

			// Set offline status
			(networkResilienceManager as any).updateNetworkStatus("offline");

			const promise = resilientSyncOperation(
				operation,
				"integration-123",
				"manual",
			);

			// Should be queued
			const queuedOps = networkResilienceManager.getQueuedOperations();
			expect(queuedOps).toHaveLength(1);
			expect(queuedOps[0].type).toBe("sync");
			expect(queuedOps[0].context?.integrationId).toBe("integration-123");
			expect(queuedOps[0].context?.syncType).toBe("manual");
		});
	});

	describe("resilientOAuthOperation", () => {
		it("should execute OAuth operations with proper context", async () => {
			const operation = vi.fn().mockResolvedValue("oauth success");

			const result = await resilientOAuthOperation(
				operation,
				"notion",
				"workspace-123",
			);

			expect(result).toBe("oauth success");
			expect(operation).toHaveBeenCalled();
		});

		it("should queue OAuth operations when offline", async () => {
			const operation = vi.fn().mockResolvedValue("oauth success");

			// Set offline status
			(networkResilienceManager as any).updateNetworkStatus("offline");

			const promise = resilientOAuthOperation(
				operation,
				"notion",
				"workspace-123",
			);

			// Should be queued
			const queuedOps = networkResilienceManager.getQueuedOperations();
			expect(queuedOps).toHaveLength(1);
			expect(queuedOps[0].type).toBe("oauth");
			expect(queuedOps[0].context?.provider).toBe("notion");
			expect(queuedOps[0].context?.workspaceId).toBe("workspace-123");
		});
	});
});

describe("Network Status Indicator", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		networkResilienceManager.clearQueue();
	});

	it("should return correct indicator for online status", () => {
		(networkResilienceManager as any).updateNetworkStatus("online");

		const indicator = getNetworkStatusIndicator();

		expect(indicator.status).toBe("online");
		expect(indicator.message).toBe("Connected");
		expect(indicator.color).toBe("text-success");
		expect(indicator.icon).toBe("🟢");
	});

	it("should return correct indicator for offline status", () => {
		(networkResilienceManager as any).updateNetworkStatus("offline");

		const indicator = getNetworkStatusIndicator();

		expect(indicator.status).toBe("offline");
		expect(indicator.message).toBe("Offline");
		expect(indicator.color).toBe("text-error");
		expect(indicator.icon).toBe("🔴");
	});

	it("should return correct indicator for slow connection", () => {
		(networkResilienceManager as any).updateNetworkStatus("slow");

		const indicator = getNetworkStatusIndicator();

		expect(indicator.status).toBe("slow");
		expect(indicator.message).toBe("Slow connection detected");
		expect(indicator.color).toBe("text-warning");
		expect(indicator.icon).toBe("🟡");
	});

	it("should show queued operations count", () => {
		(networkResilienceManager as any).updateNetworkStatus("offline");

		// Add some operations to queue
		networkResilienceManager.queueOperation("sync", vi.fn());
		networkResilienceManager.queueOperation("api_call", vi.fn());

		const indicator = getNetworkStatusIndicator();

		expect(indicator.queuedOperations).toBe(2);
		expect(indicator.message).toBe("2 operations queued");
	});
});

describe("Integration with Error Handling", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		errorStateManager.clearErrors();
		networkResilienceManager.clearQueue();
	});

	it("should add error when going offline", () => {
		(networkResilienceManager as any).updateNetworkStatus("offline");

		const errors = errorStateManager.getErrors();
		expect(errors).toHaveLength(1);
		expect(errors[0].type).toBe("network");
		expect(errors[0].message).toContain("offline");
	});

	it("should clear errors when coming back online", () => {
		// Go offline first
		(networkResilienceManager as any).updateNetworkStatus("offline");
		expect(errorStateManager.getErrors()).toHaveLength(1);

		// Come back online
		(networkResilienceManager as any).updateNetworkStatus("online");

		// Network errors should be cleared
		const networkErrors = errorStateManager.getErrorsByType("network");
		expect(networkErrors).toHaveLength(0);
	});

	it("should show recovery message when coming back online with queued operations", () => {
		// Add operations to queue while offline
		(networkResilienceManager as any).updateNetworkStatus("offline");
		networkResilienceManager.queueOperation("sync", vi.fn());
		networkResilienceManager.queueOperation("api_call", vi.fn());

		// Clear the offline error
		errorStateManager.clearErrors();

		// Come back online
		(networkResilienceManager as any).updateNetworkStatus("online");

		// Should show recovery message
		const errors = errorStateManager.getErrors();
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain("Connection restored");
		expect(errors[0].message).toContain("2 queued operations");
	});
});
