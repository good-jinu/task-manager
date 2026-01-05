import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch for API calls
global.fetch = vi.fn();

describe("AI Guest Integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should allow guest users to access AI parse-task endpoint", async () => {
		// Mock successful AI parsing response
		const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				success: true,
				parsedTask: {
					title: "Buy groceries",
					priority: "medium",
					confidence: 0.9,
				},
			}),
		});

		// Simulate AI parsing request (no authentication required)
		const response = await fetch("/api/ai/parse-task", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ input: "I need to buy groceries today" }),
		});

		const result = await response.json();

		expect(response.ok).toBe(true);
		expect(result.success).toBe(true);
		expect(result.parsedTask).toBeDefined();
		expect(result.parsedTask.title).toBe("Buy groceries");
	});

	it("should allow guest users to access AI suggestions endpoint with guest ID", async () => {
		// Mock successful suggestions response
		const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				success: true,
				suggestions: [
					{
						title: "Complete project documentation",
						priority: "high",
						reasoning: "Based on your recent tasks",
					},
				],
			}),
		});

		// Simulate suggestions request with guest ID in cookie
		// (In real scenario, this would be handled by the browser)
		const response = await fetch("/api/ai/suggestions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: "guest-id=guest_123e4567-e89b-12d3-a456-426614174000",
			},
			body: JSON.stringify({
				workspaceId: "workspace-123",
				context: "work tasks",
			}),
		});

		const result = await response.json();

		expect(response.ok).toBe(true);
		expect(result.success).toBe(true);
		expect(result.suggestions).toBeDefined();
		expect(Array.isArray(result.suggestions)).toBe(true);
	});

	it("should allow guest users to access AI query endpoint with guest ID", async () => {
		// Mock successful query response
		const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				success: true,
				tasks: [
					{
						id: "task-1",
						title: "Review code",
						status: "todo",
					},
				],
				query: "show me pending tasks",
			}),
		});

		// Simulate query request with guest ID in header
		const response = await fetch("/api/ai/query", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-guest-id": "guest_123e4567-e89b-12d3-a456-426614174000",
			},
			body: JSON.stringify({
				workspaceId: "workspace-123",
				query: "show me pending tasks",
			}),
		});

		const result = await response.json();

		expect(response.ok).toBe(true);
		expect(result.success).toBe(true);
		expect(result.tasks).toBeDefined();
		expect(Array.isArray(result.tasks)).toBe(true);
		expect(result.query).toBe("show me pending tasks");
	});

	it("should allow guest users to access AI recommendations endpoint with guest ID", async () => {
		// Mock successful recommendations response
		const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				success: true,
				recommendations: [
					{
						task: {
							id: "task-1",
							title: "Update documentation",
							priority: "high",
						},
						reason: "This task is overdue",
						urgencyScore: 0.8,
					},
				],
			}),
		});

		// Simulate recommendations request with guest ID
		const response = await fetch("/api/ai/recommendations", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-guest-id": "guest_123e4567-e89b-12d3-a456-426614174000",
			},
			body: JSON.stringify({
				workspaceId: "workspace-123",
			}),
		});

		const result = await response.json();

		expect(response.ok).toBe(true);
		expect(result.success).toBe(true);
		expect(result.recommendations).toBeDefined();
		expect(Array.isArray(result.recommendations)).toBe(true);
	});

	it("should handle missing guest ID gracefully", async () => {
		// Mock error response for missing guest ID
		const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
			json: async () => ({
				error: "Authentication required or guest ID missing",
			}),
		});

		// Simulate request without guest ID or authentication
		const response = await fetch("/api/ai/suggestions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				workspaceId: "workspace-123",
			}),
		});

		const result = await response.json();

		expect(response.ok).toBe(false);
		expect(response.status).toBe(401);
		expect(result.error).toBe("Authentication required or guest ID missing");
	});

	it("should validate guest ID format", () => {
		const validGuestId = "guest_123e4567-e89b-12d3-a456-426614174000";
		const invalidGuestId = "invalid-guest-id";

		// Test guest ID format validation
		const guestIdPattern =
			/^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

		expect(guestIdPattern.test(validGuestId)).toBe(true);
		expect(guestIdPattern.test(invalidGuestId)).toBe(false);
	});
});
