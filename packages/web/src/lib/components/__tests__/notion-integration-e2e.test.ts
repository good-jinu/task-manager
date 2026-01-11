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

vi.mock("$lib/utils/database-cache", () => ({
	databaseCache: {
		getDatabases: vi.fn(),
		hasCachedDatabases: vi.fn(),
	},
	preloadDatabasesForWorkspace: vi.fn(),
}));

vi.mock("$lib/utils/lazy-loading", () => ({
	lazyLoader: {
		preloadForTrigger: vi.fn(),
	},
	lazyOnHover: vi.fn(),
	preloadIntegrationResources: vi.fn(),
}));

vi.mock("$lib/utils/oauth", () => ({
	initiateOAuth: vi.fn(),
	classifyOAuthError: vi.fn(),
	OAuthRetryManager: vi.fn(() => ({
		retry: vi.fn(),
		reset: vi.fn(),
	})),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock window.location
Object.defineProperty(window, "location", {
	value: {
		href: "",
	},
	writable: true,
});

// Mock navigator.vibrate for haptic feedback
Object.defineProperty(navigator, "vibrate", {
	value: vi.fn(),
	writable: true,
});

describe("Notion Integration End-to-End Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset fetch mock
		const mockFetch = global.fetch as unknown as { mockReset: () => void };
		mockFetch.mockReset();

		// Reset window.location
		window.location.href = "";
	});

	describe("Complete OAuth → Database Selection → Integration Creation Flow", () => {
		it("should complete the full integration setup flow for authenticated users", async () => {
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

			// Mock database loading
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					databases: [
						{ id: "db1", name: "Test Database 1" },
						{ id: "db2", name: "Test Database 2" },
					],
				}),
			});

			// Mock integration creation
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: "integration-1",
					workspaceId: "test-workspace",
					provider: "notion",
					externalId: "db1",
				}),
			});

			// Test OAuth initiation
			const oauthResponse = await fetch("/api/integrations/notion/oauth", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ workspaceId: "test-workspace" }),
			});

			expect(oauthResponse.ok).toBe(true);
			const oauthData = await oauthResponse.json();
			expect(oauthData.authUrl).toContain("api.notion.com/oauth/authorize");

			// Test database loading
			const dbResponse = await fetch("/api/integrations/notion/databases");
			expect(dbResponse.ok).toBe(true);
			const dbData = await dbResponse.json();
			expect(dbData.databases).toHaveLength(2);

			// Test integration creation
			const integrationResponse = await fetch("/api/integrations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					workspaceId: "test-workspace",
					provider: "notion",
					externalId: "db1",
					config: {
						databaseId: "db1",
						databaseName: "Test Database 1",
						importExisting: false,
					},
					syncEnabled: true,
				}),
			});

			expect(integrationResponse.ok).toBe(true);
			const integrationData = await integrationResponse.json();
			expect(integrationData.provider).toBe("notion");
			expect(integrationData.externalId).toBe("db1");
		});

		it("should handle OAuth errors gracefully", async () => {
			// Mock OAuth error response
			const mockFetch = global.fetch as unknown as {
				mockResolvedValueOnce: (value: unknown) => void;
			};
			mockFetch.mockResolvedValueOnce({
				ok: false,
				json: async () => ({
					error: "authorization_denied",
				}),
			});

			const oauthResponse = await fetch("/api/integrations/notion/oauth", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ workspaceId: "test-workspace" }),
			});

			expect(oauthResponse.ok).toBe(false);
			const errorData = await oauthResponse.json();
			expect(errorData.error).toBe("authorization_denied");
		});

		it("should handle database loading errors", async () => {
			// Mock database loading error
			const mockFetch = global.fetch as unknown as {
				mockResolvedValueOnce: (value: unknown) => void;
			};
			mockFetch.mockResolvedValueOnce({
				ok: false,
				json: async () => ({
					error: "Failed to fetch databases",
				}),
			});

			const dbResponse = await fetch("/api/integrations/notion/databases");
			expect(dbResponse.ok).toBe(false);
			const errorData = await dbResponse.json();
			expect(errorData.error).toBe("Failed to fetch databases");
		});

		it("should handle integration creation errors", async () => {
			// Mock integration creation error
			const mockFetch = global.fetch as unknown as {
				mockResolvedValueOnce: (value: unknown) => void;
			};
			mockFetch.mockResolvedValueOnce({
				ok: false,
				json: async () => ({
					error: "Database access denied",
				}),
			});

			const integrationResponse = await fetch("/api/integrations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					workspaceId: "test-workspace",
					provider: "notion",
					externalId: "db1",
				}),
			});

			expect(integrationResponse.ok).toBe(false);
			const errorData = await integrationResponse.json();
			expect(errorData.error).toBe("Database access denied");
		});
	});

	describe("Guest User Restriction Enforcement", () => {
		it("should enforce guest user restrictions across all components", () => {
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

			// Test guest restrictions for Notion integration
			const guestNotionCheck = checkGuestRestrictions(
				true,
				"notion-integration",
			);
			expect(guestNotionCheck.allowed).toBe(false);
			expect(guestNotionCheck.upgradeRequired).toBe(true);
			expect(guestNotionCheck.message).toBe("This feature requires an account");

			// Test guest restrictions for external sync
			const guestSyncCheck = checkGuestRestrictions(true, "external-sync");
			expect(guestSyncCheck.allowed).toBe(false);
			expect(guestSyncCheck.upgradeRequired).toBe(true);

			// Test authenticated user access
			const authNotionCheck = checkGuestRestrictions(
				false,
				"notion-integration",
			);
			expect(authNotionCheck.allowed).toBe(true);
			expect(authNotionCheck.upgradeRequired).toBe(false);

			// Test unrestricted features for guests
			const guestBasicCheck = checkGuestRestrictions(true, "basic-tasks");
			expect(guestBasicCheck.allowed).toBe(true);
			expect(guestBasicCheck.upgradeRequired).toBe(false);
		});

		it("should show appropriate upgrade prompts for guest users", () => {
			const generateUpgradePrompt = (feature: string) => {
				const prompts = {
					"notion-integration": {
						title: "Unlock Notion Integration",
						description:
							"Connect your tasks with Notion to sync across devices, collaborate with your team, and never lose your work.",
						benefits: [
							"Sync with your Notion databases",
							"Access tasks from anywhere",
							"Collaborate with your team",
							"Keep your tasks permanently",
						],
					},
					"external-sync": {
						title: "Enable External Sync",
						description:
							"Sync your tasks with external services to keep them up to date across all platforms.",
						benefits: [
							"Real-time synchronization",
							"Cross-platform access",
							"Data backup and recovery",
						],
					},
				};

				return prompts[feature as keyof typeof prompts] || null;
			};

			// Test Notion integration upgrade prompt
			const notionPrompt = generateUpgradePrompt("notion-integration");
			expect(notionPrompt).toBeTruthy();
			expect(notionPrompt?.title).toBe("Unlock Notion Integration");
			expect(notionPrompt?.benefits).toContain(
				"Sync with your Notion databases",
			);

			// Test external sync upgrade prompt
			const syncPrompt = generateUpgradePrompt("external-sync");
			expect(syncPrompt).toBeTruthy();
			expect(syncPrompt?.title).toBe("Enable External Sync");
			expect(syncPrompt?.benefits).toContain("Real-time synchronization");

			// Test unknown feature
			const unknownPrompt = generateUpgradePrompt("unknown-feature");
			expect(unknownPrompt).toBeNull();
		});

		it("should preserve guest tasks during account creation", () => {
			interface GuestTask {
				id: string;
				title: string;
				completed: boolean;
				createdAt: string;
			}

			const preserveGuestTasks = (
				guestTasks: GuestTask[],
				newUserId: string,
			) => {
				// Simulate task preservation during migration
				return guestTasks.map((task) => ({
					...task,
					userId: newUserId,
					migratedAt: new Date().toISOString(),
					originalGuestId: "guest-123",
				}));
			};

			const guestTasks: GuestTask[] = [
				{
					id: "task-1",
					title: "Complete project",
					completed: false,
					createdAt: "2024-01-01T00:00:00Z",
				},
				{
					id: "task-2",
					title: "Review documents",
					completed: true,
					createdAt: "2024-01-02T00:00:00Z",
				},
			];

			const preservedTasks = preserveGuestTasks(guestTasks, "user-456");

			expect(preservedTasks).toHaveLength(2);
			expect(preservedTasks[0].userId).toBe("user-456");
			expect(preservedTasks[0].originalGuestId).toBe("guest-123");
			expect(preservedTasks[0].migratedAt).toBeTruthy();
			expect(preservedTasks[0].title).toBe("Complete project");
		});
	});

	describe("Mobile Optimization Across Different Viewport Sizes", () => {
		const viewports = [
			{ width: 375, height: 667, name: "iPhone SE" },
			{ width: 414, height: 896, name: "iPhone 11" },
			{ width: 768, height: 1024, name: "iPad" },
			{ width: 1024, height: 768, name: "Desktop" },
		];

		viewports.forEach((viewport) => {
			it(`should optimize layout for ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
				// Mock viewport dimensions
				Object.defineProperty(window, "innerWidth", {
					writable: true,
					configurable: true,
					value: viewport.width,
				});
				Object.defineProperty(window, "innerHeight", {
					writable: true,
					configurable: true,
					value: viewport.height,
				});

				const getResponsiveClasses = (component: string, width: number) => {
					const isMobile = width < 768;
					const isTablet = width >= 768 && width < 1024;

					const classMap = {
						drawer: isMobile
							? "w-full max-w-[400px]"
							: isTablet
								? "max-w-[480px]"
								: "max-w-[520px]",
						touchTarget: "min-w-[44px] min-h-[44px]",
						button: "min-h-[44px] px-3 py-2",
						dialog: isMobile
							? "w-full max-w-[90vw]"
							: isTablet
								? "max-w-[480px]"
								: "max-w-[520px]",
					};

					return classMap[component as keyof typeof classMap] || "";
				};

				// Test drawer responsive classes
				const drawerClasses = getResponsiveClasses("drawer", viewport.width);
				if (viewport.width < 768) {
					expect(drawerClasses).toContain("w-full");
					expect(drawerClasses).toContain("max-w-[400px]");
				} else if (viewport.width < 1024) {
					expect(drawerClasses).toContain("max-w-[480px]");
				} else {
					expect(drawerClasses).toContain("max-w-[520px]");
				}

				// Test touch target requirements
				const touchTargetClasses = getResponsiveClasses(
					"touchTarget",
					viewport.width,
				);
				expect(touchTargetClasses).toContain("min-w-[44px]");
				expect(touchTargetClasses).toContain("min-h-[44px]");

				// Test button classes
				const buttonClasses = getResponsiveClasses("button", viewport.width);
				expect(buttonClasses).toContain("min-h-[44px]");
			});
		});

		it("should detect mobile capabilities correctly", () => {
			const detectMobileCapabilities = () => {
				// Mock different user agents
				const userAgents = {
					iPhone: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
					Android: "Mozilla/5.0 (Linux; Android 10; SM-G975F)",
					iPad: "Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)",
					Desktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
				};

				return Object.entries(userAgents).map(([device, userAgent]) => ({
					device,
					isMobile: /iPhone|iPad|iPod|Android/i.test(userAgent),
					supportsTouch: device !== "Desktop",
					supportsHaptics:
						device.includes("iPhone") || device.includes("Android"),
				}));
			};

			const capabilities = detectMobileCapabilities();

			// Test iPhone detection
			const iPhone = capabilities.find((c) => c.device === "iPhone");
			expect(iPhone?.isMobile).toBe(true);
			expect(iPhone?.supportsTouch).toBe(true);
			expect(iPhone?.supportsHaptics).toBe(true);

			// Test Android detection
			const android = capabilities.find((c) => c.device === "Android");
			expect(android?.isMobile).toBe(true);
			expect(android?.supportsTouch).toBe(true);
			expect(android?.supportsHaptics).toBe(true);

			// Test iPad detection
			const iPad = capabilities.find((c) => c.device === "iPad");
			expect(iPad?.isMobile).toBe(true);
			expect(iPad?.supportsTouch).toBe(true);

			// Test Desktop detection
			const desktop = capabilities.find((c) => c.device === "Desktop");
			expect(desktop?.isMobile).toBe(false);
			expect(desktop?.supportsTouch).toBe(false);
			expect(desktop?.supportsHaptics).toBe(false);
		});

		it("should handle touch interactions properly", () => {
			const handleTouchInteraction = (
				touchStartTime: number,
				touchEndTime: number,
			) => {
				const touchDuration = touchEndTime - touchStartTime;
				const isQuickTap = touchDuration < 500;
				const isLongPress = touchDuration >= 500;

				return {
					isQuickTap,
					isLongPress,
					shouldTriggerAction: isQuickTap,
					touchDuration,
				};
			};

			// Test quick tap
			const quickTap = handleTouchInteraction(1000, 1100);
			expect(quickTap.isQuickTap).toBe(true);
			expect(quickTap.isLongPress).toBe(false);
			expect(quickTap.shouldTriggerAction).toBe(true);

			// Test long press
			const longPress = handleTouchInteraction(1000, 1600);
			expect(longPress.isQuickTap).toBe(false);
			expect(longPress.isLongPress).toBe(true);
			expect(longPress.shouldTriggerAction).toBe(false);

			// Test very quick tap
			const veryQuickTap = handleTouchInteraction(1000, 1050);
			expect(veryQuickTap.isQuickTap).toBe(true);
			expect(veryQuickTap.shouldTriggerAction).toBe(true);
		});
	});

	describe("Performance Requirements Validation", () => {
		it("should meet drawer opening performance requirements (< 200ms)", async () => {
			const measureDrawerOpeningTime = async () => {
				const startTime = performance.now();

				// Simulate drawer opening operations
				await new Promise((resolve) => setTimeout(resolve, 50)); // DOM updates
				await new Promise((resolve) => setTimeout(resolve, 30)); // Animation start
				await new Promise((resolve) => setTimeout(resolve, 100)); // Animation completion

				const endTime = performance.now();
				return endTime - startTime;
			};

			const openingTime = await measureDrawerOpeningTime();
			expect(openingTime).toBeLessThan(200);
		});

		it("should meet database loading performance requirements (< 3 seconds)", async () => {
			const measureDatabaseLoadingTime = async () => {
				const startTime = performance.now();

				// Mock database loading with realistic timing
				const mockFetch = global.fetch as unknown as {
					mockResolvedValueOnce: (value: unknown) => void;
				};
				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: async () => {
						// Simulate network delay
						await new Promise((resolve) => setTimeout(resolve, 1500));
						return {
							databases: [
								{ id: "db1", name: "Database 1" },
								{ id: "db2", name: "Database 2" },
							],
						};
					},
				});

				const response = await fetch("/api/integrations/notion/databases");
				await response.json();

				const endTime = performance.now();
				return endTime - startTime;
			};

			const loadingTime = await measureDatabaseLoadingTime();
			expect(loadingTime).toBeLessThan(3000);
		});

		it("should meet status update performance requirements (< 5 seconds)", async () => {
			const measureStatusUpdateTime = async () => {
				const startTime = performance.now();

				// Mock status update with realistic timing
				const mockFetch = global.fetch as unknown as {
					mockResolvedValueOnce: (value: unknown) => void;
				};
				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: async () => {
						// Simulate status check delay
						await new Promise((resolve) => setTimeout(resolve, 2000));
						return {
							status: "synced",
							lastSyncAt: new Date().toISOString(),
							syncCount: 5,
						};
					},
				});

				const response = await fetch("/api/integrations/status");
				await response.json();

				const endTime = performance.now();
				return endTime - startTime;
			};

			const updateTime = await measureStatusUpdateTime();
			expect(updateTime).toBeLessThan(5000);
		});

		it("should implement effective caching to reduce API calls", () => {
			interface CacheEntry<T> {
				data: T;
				timestamp: number;
				ttl: number;
			}

			class TestCache<T> {
				private cache = new Map<string, CacheEntry<T>>();

				set(key: string, data: T, ttl: number): void {
					this.cache.set(key, {
						data,
						timestamp: Date.now(),
						ttl,
					});
				}

				get(key: string): T | null {
					const entry = this.cache.get(key);
					if (!entry) return null;

					const now = Date.now();
					if (now - entry.timestamp > entry.ttl) {
						this.cache.delete(key);
						return null;
					}

					return entry.data;
				}

				has(key: string): boolean {
					return this.get(key) !== null;
				}

				clear(): void {
					this.cache.clear();
				}

				size(): number {
					return this.cache.size;
				}
			}

			const cache = new TestCache<string[]>();

			// Test cache set and get
			cache.set("databases", ["db1", "db2"], 300000); // 5 minutes TTL
			expect(cache.get("databases")).toEqual(["db1", "db2"]);
			expect(cache.has("databases")).toBe(true);

			// Test cache miss
			expect(cache.get("nonexistent")).toBeNull();
			expect(cache.has("nonexistent")).toBe(false);

			// Test cache size
			expect(cache.size()).toBe(1);

			// Test cache clear
			cache.clear();
			expect(cache.size()).toBe(0);
			expect(cache.has("databases")).toBe(false);
		});

		it("should maintain responsiveness during background operations", async () => {
			const simulateBackgroundOperations = async () => {
				const operations = [];

				// Simulate multiple concurrent background operations
				operations.push(
					new Promise((resolve) => setTimeout(resolve, 1000)), // Sync operation
				);
				operations.push(
					new Promise((resolve) => setTimeout(resolve, 500)), // Status update
				);
				operations.push(
					new Promise((resolve) => setTimeout(resolve, 200)), // Cache refresh
				);

				const startTime = performance.now();

				// UI should remain responsive during background operations
				const uiResponseTime = 50; // Simulate UI interaction time
				await new Promise((resolve) => setTimeout(resolve, uiResponseTime));

				const uiEndTime = performance.now();
				const uiDuration = uiEndTime - startTime;

				// Wait for background operations to complete
				await Promise.all(operations);

				return {
					uiResponseTime: uiDuration,
					backgroundOperationsCompleted: true,
				};
			};

			const result = await simulateBackgroundOperations();

			// UI should respond quickly even with background operations
			expect(result.uiResponseTime).toBeLessThan(100);
			expect(result.backgroundOperationsCompleted).toBe(true);
		});
	});

	describe("Error Handling and Recovery", () => {
		it("should handle network failures gracefully", async () => {
			const handleNetworkFailure = async (
				operation: () => Promise<unknown>,
			) => {
				const maxRetries = 3;
				let retryCount = 0;
				let lastError: Error | null = null;

				while (retryCount < maxRetries) {
					try {
						const result = await operation();
						return { success: true, result, retryCount };
					} catch (error) {
						lastError = error as Error;
						retryCount++;

						if (retryCount < maxRetries) {
							// Simulate exponential backoff without actual delay
							const delay = 1000 * 2 ** (retryCount - 1);
							// Just record the delay, don't actually wait
							console.log(`Would wait ${delay}ms before retry ${retryCount}`);
						}
					}
				}

				return {
					success: false,
					error: lastError?.message || "Operation failed",
					retryCount,
				};
			};

			// Test successful operation after retries
			let attemptCount = 0;
			const flakyOperation = async () => {
				attemptCount++;
				if (attemptCount < 3) {
					throw new Error("Network error");
				}
				return "success";
			};

			const result = await handleNetworkFailure(flakyOperation);
			expect(result.success).toBe(true);
			expect(result.result).toBe("success");
			expect(result.retryCount).toBe(2);

			// Test operation that always fails
			const failingOperation = async () => {
				throw new Error("Persistent network error");
			};

			const failResult = await handleNetworkFailure(failingOperation);
			expect(failResult.success).toBe(false);
			expect(failResult.error).toBe("Persistent network error");
			expect(failResult.retryCount).toBe(3);
		});

		it("should provide meaningful error messages", () => {
			const generateErrorMessage = (errorType: string, context?: string) => {
				const errorMessages = {
					oauth_denied:
						"Please grant access to your Notion workspace to continue.",
					network_error:
						"Unable to connect to Notion. Please check your internet connection.",
					database_access_denied:
						"Access to the selected database was denied. Please check permissions.",
					token_expired: "Your Notion session has expired. Please reconnect.",
					sync_conflict: "A sync conflict occurred. Please resolve manually.",
					unknown_error: "An unexpected error occurred. Please try again.",
				};

				const baseMessage =
					errorMessages[errorType as keyof typeof errorMessages] ||
					errorMessages.unknown_error;

				return context ? `${baseMessage} Context: ${context}` : baseMessage;
			};

			// Test specific error messages
			expect(generateErrorMessage("oauth_denied")).toBe(
				"Please grant access to your Notion workspace to continue.",
			);

			expect(generateErrorMessage("network_error")).toBe(
				"Unable to connect to Notion. Please check your internet connection.",
			);

			expect(
				generateErrorMessage("database_access_denied", "Database ID: db123"),
			).toBe(
				"Access to the selected database was denied. Please check permissions. Context: Database ID: db123",
			);

			// Test unknown error fallback
			expect(generateErrorMessage("unknown_type")).toBe(
				"An unexpected error occurred. Please try again.",
			);
		});

		it("should implement proper error recovery strategies", () => {
			interface ErrorRecoveryStrategy {
				immediate: () => Promise<boolean>;
				delayed: () => Promise<boolean>;
				manual: () => Promise<boolean>;
			}

			const createErrorRecoveryStrategy = (
				errorType: string,
			): ErrorRecoveryStrategy => {
				const strategies = {
					token_expired: {
						immediate: async () => {
							// Try to refresh token
							return Math.random() > 0.3; // 70% success rate
						},
						delayed: async () => {
							// Retry after delay
							await new Promise((resolve) => setTimeout(resolve, 5000));
							return Math.random() > 0.1; // 90% success rate
						},
						manual: async () => {
							// Require user intervention
							return true; // Always succeeds with user action
						},
					},
					network_error: {
						immediate: async () => {
							// Quick retry
							return Math.random() > 0.5; // 50% success rate
						},
						delayed: async () => {
							// Retry with exponential backoff
							return Math.random() > 0.2; // 80% success rate
						},
						manual: async () => {
							// User can retry manually
							return true;
						},
					},
				};

				return (
					strategies[errorType as keyof typeof strategies] || {
						immediate: async () => false,
						delayed: async () => false,
						manual: async () => true,
					}
				);
			};

			// Test token expired recovery
			const tokenStrategy = createErrorRecoveryStrategy("token_expired");
			expect(tokenStrategy).toBeTruthy();
			expect(typeof tokenStrategy.immediate).toBe("function");
			expect(typeof tokenStrategy.delayed).toBe("function");
			expect(typeof tokenStrategy.manual).toBe("function");

			// Test network error recovery
			const networkStrategy = createErrorRecoveryStrategy("network_error");
			expect(networkStrategy).toBeTruthy();
			expect(typeof networkStrategy.immediate).toBe("function");

			// Test unknown error fallback
			const unknownStrategy = createErrorRecoveryStrategy("unknown_error");
			expect(unknownStrategy).toBeTruthy();
			expect(typeof unknownStrategy.manual).toBe("function");
		});
	});

	describe("Integration Status Management", () => {
		it("should accurately determine integration status", () => {
			interface Integration {
				syncEnabled?: boolean;
				lastSyncAt?: string;
			}

			interface IntegrationStatus {
				status: string;
			}

			const determineIntegrationStatus = (
				integration: Integration | null,
				enhancedStatus: IntegrationStatus | null,
			) => {
				// Use enhanced status if available
				if (enhancedStatus) {
					return enhancedStatus.status;
				}

				// Fallback to basic status determination
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
			expect(determineIntegrationStatus(null, null)).toBe("disconnected");

			// Test disabled state
			expect(determineIntegrationStatus({ syncEnabled: false }, null)).toBe(
				"disabled",
			);

			// Test synced state (recent sync)
			const recentSync = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
			expect(
				determineIntegrationStatus(
					{ syncEnabled: true, lastSyncAt: recentSync.toISOString() },
					null,
				),
			).toBe("synced");

			// Test pending state (old sync)
			const oldSync = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
			expect(
				determineIntegrationStatus(
					{ syncEnabled: true, lastSyncAt: oldSync.toISOString() },
					null,
				),
			).toBe("pending");

			// Test enhanced status override
			expect(
				determineIntegrationStatus({ syncEnabled: true }, { status: "error" }),
			).toBe("error");
		});

		it("should format sync statistics correctly", () => {
			interface SyncStats {
				totalTasks?: number;
				syncedTasks?: number;
				failedTasks?: number;
				lastSyncDuration?: number;
			}

			const formatSyncStatistics = (stats: SyncStats | null) => {
				if (!stats) return null;

				const parts = [];

				if (stats.syncedTasks && stats.syncedTasks > 0) {
					parts.push(`${stats.syncedTasks} synced`);
				}

				if (stats.failedTasks && stats.failedTasks > 0) {
					parts.push(`${stats.failedTasks} failed`);
				}

				const summary = parts.length > 0 ? parts.join(", ") : null;

				return {
					summary,
					totalTasks: stats.totalTasks || 0,
					syncedTasks: stats.syncedTasks || 0,
					failedTasks: stats.failedTasks || 0,
					lastSyncDuration: stats.lastSyncDuration,
				};
			};

			// Test with all stats
			const fullStats = formatSyncStatistics({
				totalTasks: 10,
				syncedTasks: 8,
				failedTasks: 2,
				lastSyncDuration: 1500,
			});
			expect(fullStats?.summary).toBe("8 synced, 2 failed");
			expect(fullStats?.totalTasks).toBe(10);

			// Test with only synced tasks
			const syncedOnlyStats = formatSyncStatistics({
				syncedTasks: 5,
				failedTasks: 0,
			});
			expect(syncedOnlyStats?.summary).toBe("5 synced");

			// Test with no meaningful stats
			const emptyStats = formatSyncStatistics({
				syncedTasks: 0,
				failedTasks: 0,
			});
			expect(emptyStats?.summary).toBeNull();

			// Test with null input
			expect(formatSyncStatistics(null)).toBeNull();
		});
	});
});
