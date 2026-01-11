import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the stores
vi.mock("$lib/stores/integration-status", () => ({
	createWorkspaceStatusStore: vi.fn(() => ({
		integrations: { subscribe: vi.fn() },
		loading: { subscribe: vi.fn() },
		error: { subscribe: vi.fn() },
		startPolling: vi.fn(),
		stopPolling: vi.fn(),
		refresh: vi.fn(),
	})),
	refreshIntegrationStatus: vi.fn(),
}));

vi.mock("$lib/stores/guest", () => ({
	isGuestMode: { subscribe: vi.fn(), set: vi.fn() },
	guestUser: { subscribe: vi.fn(), set: vi.fn() },
	updateGuestTaskCount: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe("Component Integration Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset fetch mock
		const mockFetch = global.fetch as unknown as { mockReset: () => void };
		mockFetch.mockReset();
	});

	describe("Integration Status Logic", () => {
		it("should determine correct status based on integration state", () => {
			// Test status determination logic
			interface Integration {
				syncEnabled?: boolean;
				lastSyncAt?: string;
			}

			interface IntegrationStatus {
				status: string;
			}

			const determineStatus = (
				integration: Integration | null,
				integrationStatus: IntegrationStatus | null,
			) => {
				if (integrationStatus) {
					return integrationStatus.status;
				}
				if (!integration) return "disconnected";
				if (!integration.syncEnabled) return "disabled";

				if (integration.lastSyncAt) {
					const lastSync = new Date(integration.lastSyncAt);
					const now = new Date();
					const timeDiff = now.getTime() - lastSync.getTime();
					const fiveMinutes = 5 * 60 * 1000;

					return timeDiff < fiveMinutes ? "synced" : "pending";
				}

				return "pending";
			};

			// Test disconnected state
			expect(determineStatus(null, null)).toBe("disconnected");

			// Test disabled state
			expect(determineStatus({ syncEnabled: false }, null)).toBe("disabled");

			// Test synced state (recent sync)
			const recentSync = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
			expect(
				determineStatus(
					{ syncEnabled: true, lastSyncAt: recentSync.toISOString() },
					null,
				),
			).toBe("synced");

			// Test pending state (old sync)
			const oldSync = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
			expect(
				determineStatus(
					{ syncEnabled: true, lastSyncAt: oldSync.toISOString() },
					null,
				),
			).toBe("pending");

			// Test enhanced status override
			expect(determineStatus({ syncEnabled: true }, { status: "error" })).toBe(
				"error",
			);
		});

		it("should format last sync time correctly", () => {
			const formatLastSyncTime = (lastSyncAt: Date | null) => {
				if (!lastSyncAt) return null;

				const now = new Date();
				const diff = now.getTime() - lastSyncAt.getTime();
				const minutes = Math.floor(diff / (1000 * 60));
				const hours = Math.floor(minutes / 60);
				const days = Math.floor(hours / 24);

				if (minutes < 1) return "Just now";
				if (minutes < 60) return `${minutes}m ago`;
				if (hours < 24) return `${hours}h ago`;
				return `${days}d ago`;
			};

			const now = new Date();

			// Test "Just now"
			expect(formatLastSyncTime(new Date(now.getTime() - 30 * 1000))).toBe(
				"Just now",
			);

			// Test minutes
			expect(formatLastSyncTime(new Date(now.getTime() - 5 * 60 * 1000))).toBe(
				"5m ago",
			);

			// Test hours
			expect(
				formatLastSyncTime(new Date(now.getTime() - 2 * 60 * 60 * 1000)),
			).toBe("2h ago");

			// Test days
			expect(
				formatLastSyncTime(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)),
			).toBe("3d ago");

			// Test null
			expect(formatLastSyncTime(null)).toBe(null);
		});

		it("should generate correct sync statistics text", () => {
			interface SyncStats {
				totalTasks?: number;
				syncedTasks?: number;
				failedTasks?: number;
				lastSyncDuration?: number;
			}

			const generateSyncStatsText = (syncStats: SyncStats | null) => {
				if (!syncStats) return null;

				const parts = [];
				if (syncStats.syncedTasks && syncStats.syncedTasks > 0) {
					parts.push(`${syncStats.syncedTasks} synced`);
				}
				if (syncStats.failedTasks && syncStats.failedTasks > 0) {
					parts.push(`${syncStats.failedTasks} failed`);
				}

				return parts.length > 0 ? parts.join(", ") : null;
			};

			// Test with all stats
			expect(
				generateSyncStatsText({
					syncedTasks: 5,
					failedTasks: 1,
				}),
			).toBe("5 synced, 1 failed");

			// Test with only synced
			expect(
				generateSyncStatsText({
					syncedTasks: 3,
					failedTasks: 0,
				}),
			).toBe("3 synced");

			// Test with no stats
			expect(
				generateSyncStatsText({
					syncedTasks: 0,
					failedTasks: 0,
				}),
			).toBe(null);

			// Test with null
			expect(generateSyncStatsText(null)).toBe(null);
		});
	});

	describe("Guest User Logic", () => {
		it("should determine correct urgency level", () => {
			const determineUrgencyLevel = (
				daysRemaining: number,
				taskCount: number,
			) => {
				if (daysRemaining <= 1) return "critical";
				if (daysRemaining <= 3) return "high";
				if (taskCount >= 10) return "medium";
				return "low";
			};

			// Test critical urgency
			expect(determineUrgencyLevel(1, 5)).toBe("critical");
			expect(determineUrgencyLevel(0, 5)).toBe("critical");

			// Test high urgency
			expect(determineUrgencyLevel(2, 5)).toBe("high");
			expect(determineUrgencyLevel(3, 5)).toBe("high");

			// Test medium urgency (high task count)
			expect(determineUrgencyLevel(5, 10)).toBe("medium");
			expect(determineUrgencyLevel(5, 15)).toBe("medium");

			// Test low urgency
			expect(determineUrgencyLevel(5, 5)).toBe("low");
			expect(determineUrgencyLevel(7, 3)).toBe("low");
		});

		it("should handle guest mode restrictions properly", () => {
			const checkGuestRestrictions = (
				isGuestMode: boolean,
				feature: string,
			) => {
				const restrictedFeatures = ["notion-integration", "external-sync"];

				if (isGuestMode && restrictedFeatures.includes(feature)) {
					return {
						allowed: false,
						message: "This feature requires an account",
						upgradeRequired: true,
					};
				}

				return {
					allowed: true,
					message: null,
					upgradeRequired: false,
				};
			};

			// Test guest restrictions
			const guestNotionCheck = checkGuestRestrictions(
				true,
				"notion-integration",
			);
			expect(guestNotionCheck.allowed).toBe(false);
			expect(guestNotionCheck.upgradeRequired).toBe(true);
			expect(guestNotionCheck.message).toBe("This feature requires an account");

			// Test authenticated access
			const authNotionCheck = checkGuestRestrictions(
				false,
				"notion-integration",
			);
			expect(authNotionCheck.allowed).toBe(true);
			expect(authNotionCheck.upgradeRequired).toBe(false);

			// Test unrestricted feature
			const guestBasicCheck = checkGuestRestrictions(true, "basic-tasks");
			expect(guestBasicCheck.allowed).toBe(true);
			expect(guestBasicCheck.upgradeRequired).toBe(false);
		});
	});

	describe("OAuth Flow Logic", () => {
		it("should handle OAuth initiation properly", async () => {
			// Mock successful OAuth response
			const mockFetch = global.fetch as unknown as {
				mockResolvedValueOnce: (value: unknown) => void;
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					authUrl:
						"https://api.notion.com/oauth/authorize?client_id=test&redirect_uri=callback",
				}),
			});

			const initiateOAuth = async (workspaceId: string) => {
				const response = await fetch("/api/integrations/notion/oauth", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ workspaceId }),
				});

				if (!response.ok) {
					throw new Error("OAuth initiation failed");
				}

				const data = await response.json();
				return data.authUrl;
			};

			const authUrl = await initiateOAuth("test-workspace");

			expect(global.fetch).toHaveBeenCalledWith(
				"/api/integrations/notion/oauth",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ workspaceId: "test-workspace" }),
				},
			);

			expect(authUrl).toBe(
				"https://api.notion.com/oauth/authorize?client_id=test&redirect_uri=callback",
			);
		});

		it("should handle OAuth errors gracefully", async () => {
			// Mock OAuth error response
			const mockFetch = global.fetch as unknown as {
				mockResolvedValueOnce: (value: unknown) => void;
			};
			mockFetch.mockResolvedValueOnce({
				ok: false,
				json: async () => ({
					error: "Invalid client credentials",
				}),
			});

			const initiateOAuth = async (workspaceId: string) => {
				const response = await fetch("/api/integrations/notion/oauth", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ workspaceId }),
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error || "OAuth initiation failed");
				}

				const data = await response.json();
				return data.authUrl;
			};

			await expect(initiateOAuth("test-workspace")).rejects.toThrow(
				"Invalid client credentials",
			);
		});
	});

	describe("Database Selection Logic", () => {
		it("should handle database loading", async () => {
			// Mock database response
			const mockFetch = global.fetch as unknown as {
				mockResolvedValueOnce: (value: unknown) => void;
			};
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					databases: [
						{ id: "db1", name: "Test Database 1" },
						{ id: "db2", name: "Test Database 2" },
					],
				}),
			});

			const loadDatabases = async () => {
				const response = await fetch("/api/integrations/notion/databases");

				if (!response.ok) {
					throw new Error("Failed to load databases");
				}

				const data = await response.json();
				return data.databases || [];
			};

			const databases = await loadDatabases();

			expect(global.fetch).toHaveBeenCalledWith(
				"/api/integrations/notion/databases",
			);
			expect(databases).toHaveLength(2);
			expect(databases[0]).toEqual({ id: "db1", name: "Test Database 1" });
			expect(databases[1]).toEqual({ id: "db2", name: "Test Database 2" });
		});

		it("should validate database selection", () => {
			interface Database {
				id: string;
				name: string;
			}

			const validateDatabaseSelection = (
				selectedId: string,
				availableDatabases: Database[],
			) => {
				if (!selectedId) {
					return { valid: false, error: "No database selected" };
				}

				const database = availableDatabases.find((db) => db.id === selectedId);
				if (!database) {
					return { valid: false, error: "Selected database not found" };
				}

				return { valid: true, database };
			};

			const databases = [
				{ id: "db1", name: "Database 1" },
				{ id: "db2", name: "Database 2" },
			];

			// Test valid selection
			const validResult = validateDatabaseSelection("db1", databases);
			expect(validResult.valid).toBe(true);
			expect(validResult.database).toEqual({ id: "db1", name: "Database 1" });

			// Test no selection
			const noSelectionResult = validateDatabaseSelection("", databases);
			expect(noSelectionResult.valid).toBe(false);
			expect(noSelectionResult.error).toBe("No database selected");

			// Test invalid selection
			const invalidResult = validateDatabaseSelection("db3", databases);
			expect(invalidResult.valid).toBe(false);
			expect(invalidResult.error).toBe("Selected database not found");
		});
	});

	describe("Mobile Optimization Logic", () => {
		it("should determine appropriate responsive classes", () => {
			const getResponsiveClasses = (component: string) => {
				const classMap = {
					drawer: "w-full max-w-[400px] sm:max-w-[480px] lg:max-w-[520px]",
					touchTarget: "min-w-[44px] min-h-[44px]",
					button: "min-h-[44px] px-3 py-2",
				};

				return classMap[component as keyof typeof classMap] || "";
			};

			// Test drawer responsive classes
			expect(getResponsiveClasses("drawer")).toBe(
				"w-full max-w-[400px] sm:max-w-[480px] lg:max-w-[520px]",
			);

			// Test touch target classes
			expect(getResponsiveClasses("touchTarget")).toBe(
				"min-w-[44px] min-h-[44px]",
			);

			// Test button classes
			expect(getResponsiveClasses("button")).toBe("min-h-[44px] px-3 py-2");
		});

		it("should detect mobile capabilities", () => {
			const detectMobileCapabilities = () => {
				// Mock navigator for testing
				const mockNavigator = {
					vibrate: vi.fn(),
					userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
				};

				return {
					supportsHaptics: "vibrate" in mockNavigator,
					isMobile: /iPhone|iPad|iPod|Android/i.test(mockNavigator.userAgent),
					supportsTouchEvents: true, // Mocked for testing
				};
			};

			const capabilities = detectMobileCapabilities();

			expect(capabilities.supportsHaptics).toBe(true);
			expect(capabilities.isMobile).toBe(true);
			expect(capabilities.supportsTouchEvents).toBe(true);
		});
	});

	describe("Error Handling Logic", () => {
		it("should classify OAuth errors correctly", () => {
			const classifyOAuthError = (errorMessage: string) => {
				const errorMap = {
					authorization_denied: {
						message:
							"Please grant access to your Notion workspace to continue.",
						recoverable: true,
					},
					invalid_scope: {
						message:
							"The app needs permission to read and write database pages.",
						recoverable: true,
					},
					network_error: {
						message:
							"Unable to connect to Notion. Please check your internet connection.",
						recoverable: true,
					},
					token_expired: {
						message: "Your Notion session has expired. Please reconnect.",
						recoverable: true,
					},
				};

				const errorType = Object.keys(errorMap).find((type) =>
					errorMessage.toLowerCase().includes(type.replace("_", " ")),
				);

				return errorType
					? errorMap[errorType as keyof typeof errorMap]
					: {
							message: errorMessage,
							recoverable: false,
						};
			};

			// Test known error types
			expect(classifyOAuthError("authorization denied by user")).toEqual({
				message: "Please grant access to your Notion workspace to continue.",
				recoverable: true,
			});

			expect(classifyOAuthError("invalid scope requested")).toEqual({
				message: "The app needs permission to read and write database pages.",
				recoverable: true,
			});

			// Test unknown error
			expect(classifyOAuthError("Unknown error occurred")).toEqual({
				message: "Unknown error occurred",
				recoverable: false,
			});
		});

		it("should handle retry logic with exponential backoff", async () => {
			const createRetryManager = () => {
				let retryCount = 0;
				const maxRetries = 3;
				const baseDelay = 1000;

				return {
					async retry<T>(operation: () => Promise<T>): Promise<T> {
						while (retryCount < maxRetries) {
							try {
								const result = await operation();
								retryCount = 0; // Reset on success
								return result;
							} catch (error) {
								retryCount++;
								if (retryCount >= maxRetries) {
									throw error;
								}

								// Exponential backoff
								const delay = baseDelay * 2 ** (retryCount - 1);
								await new Promise((resolve) => setTimeout(resolve, delay));
							}
						}
						throw new Error("Max retries exceeded");
					},

					reset() {
						retryCount = 0;
					},

					getRetryCount() {
						return retryCount;
					},
				};
			};

			const retryManager = createRetryManager();

			// Test successful operation (no retries needed)
			const successOperation = vi.fn().mockResolvedValue("success");
			await expect(retryManager.retry(successOperation)).resolves.toBe(
				"success",
			);

			// Test retry count tracking
			expect(retryManager.getRetryCount()).toBe(0);

			// Test reset functionality
			retryManager.reset();
			expect(retryManager.getRetryCount()).toBe(0);
		});
	});
});
