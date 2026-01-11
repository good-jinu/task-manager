/**
 * Component wiring system for Notion integration improvements
 * Provides centralized data flow, error propagation, and logging
 */

import type {
	ExternalIntegration,
	Task,
	Workspace,
} from "@notion-task-manager/db";
import { refreshIntegrationStatus } from "$lib/stores/integration-status";
import { databaseCache } from "./database-cache";
import {
	createErrorFromTemplate,
	errorStateManager,
	handleApiError,
} from "./error-handling";
import { lazyLoader } from "./lazy-loading";

/**
 * Component event types for centralized handling
 */
export type ComponentEvent =
	| { type: "settings_drawer_opened"; workspaceId: string }
	| { type: "settings_drawer_closed" }
	| {
			type: "integration_toggle";
			provider: string;
			enabled: boolean;
			workspaceId: string;
	  }
	| { type: "oauth_initiated"; provider: string; workspaceId: string }
	| {
			type: "oauth_completed";
			provider: string;
			workspaceId: string;
			success: boolean;
	  }
	| { type: "database_selected"; databaseId: string; workspaceId: string }
	| { type: "integration_created"; integrationId: string; workspaceId: string }
	| {
			type: "integration_disconnected";
			integrationId: string;
			workspaceId: string;
	  }
	| { type: "sync_triggered"; integrationId: string }
	| { type: "sync_completed"; integrationId: string; success: boolean }
	| { type: "guest_upgrade_prompted"; feature: string }
	| { type: "guest_account_created"; guestId: string; userId: string }
	| { type: "error_occurred"; error: any; context?: Record<string, unknown> }
	| {
			type: "performance_measured";
			metric: string;
			duration: number;
			context?: Record<string, unknown>;
	  };

/**
 * Component state interface for centralized state management
 */
export interface ComponentState {
	// UI State
	settingsDrawerOpen: boolean;
	notionDialogOpen: boolean;
	guestUpgradePromptOpen: boolean;
	accountDialogOpen: boolean;

	// Data State
	currentWorkspace: Workspace | null;
	integrations: ExternalIntegration[];
	tasks: Task[];

	// Loading States
	loadingIntegrations: boolean;
	loadingDatabases: boolean;
	loadingTasks: boolean;

	// Error States
	errors: string[]; // Error IDs from error state manager

	// Performance Metrics
	performanceMetrics: Map<string, number>;
}

/**
 * Component wiring manager for centralized coordination
 */
export class ComponentWiringManager {
	private state: ComponentState = {
		settingsDrawerOpen: false,
		notionDialogOpen: false,
		guestUpgradePromptOpen: false,
		accountDialogOpen: false,
		currentWorkspace: null,
		integrations: [],
		tasks: [],
		loadingIntegrations: false,
		loadingDatabases: false,
		loadingTasks: false,
		errors: [],
		performanceMetrics: new Map(),
	};

	private listeners = new Set<(state: ComponentState) => void>();
	private eventListeners = new Set<(event: ComponentEvent) => void>();
	private logger = new ComponentLogger();

	/**
	 * Subscribe to state changes
	 */
	subscribe(listener: (state: ComponentState) => void): () => void {
		this.listeners.add(listener);
		// Immediately call with current state
		listener(this.state);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Subscribe to component events
	 */
	subscribeToEvents(listener: (event: ComponentEvent) => void): () => void {
		this.eventListeners.add(listener);
		return () => this.eventListeners.delete(listener);
	}

	/**
	 * Emit a component event
	 */
	emit(event: ComponentEvent): void {
		this.logger.logEvent(event);
		this.eventListeners.forEach((listener) => {
			try {
				listener(event);
			} catch (error) {
				console.error("Error in event listener:", error);
				this.handleError(error, { event });
			}
		});

		// Handle state updates based on events
		this.handleEventStateUpdate(event);
	}

	/**
	 * Update component state
	 */
	updateState(updates: Partial<ComponentState>): void {
		const previousState = { ...this.state };
		this.state = { ...this.state, ...updates };

		this.logger.logStateChange(previousState, this.state);
		this.notifyStateListeners();
	}

	/**
	 * Get current state
	 */
	getState(): ComponentState {
		return { ...this.state };
	}

	/**
	 * Handle settings drawer operations
	 */
	async openSettingsDrawer(workspaceId: string): Promise<void> {
		const startTime = performance.now();

		try {
			this.updateState({ settingsDrawerOpen: true });
			this.emit({ type: "settings_drawer_opened", workspaceId });

			// Preload resources
			await this.preloadSettingsResources(workspaceId);

			// Measure performance
			const duration = performance.now() - startTime;
			this.emit({
				type: "performance_measured",
				metric: "settings_drawer_open",
				duration,
				context: { workspaceId },
			});

			// Validate performance requirement (< 200ms)
			if (duration > 200) {
				this.logger.logPerformanceWarning(
					"settings_drawer_open",
					duration,
					200,
				);
			}
		} catch (error) {
			this.handleError(error, { action: "open_settings_drawer", workspaceId });
		}
	}

	closeSettingsDrawer(): void {
		this.updateState({ settingsDrawerOpen: false });
		this.emit({ type: "settings_drawer_closed" });
	}

	/**
	 * Handle integration toggle operations
	 */
	async toggleIntegration(
		provider: string,
		enabled: boolean,
		workspaceId: string,
	): Promise<void> {
		try {
			this.emit({ type: "integration_toggle", provider, enabled, workspaceId });

			if (enabled && provider === "notion") {
				// Initiate OAuth flow
				await this.initiateOAuth(provider, workspaceId);
			} else {
				// Handle existing integration toggle
				await this.updateIntegrationSync(provider, enabled, workspaceId);
			}
		} catch (error) {
			this.handleError(error, {
				action: "toggle_integration",
				provider,
				enabled,
				workspaceId,
			});
		}
	}

	/**
	 * Handle OAuth flow
	 */
	async initiateOAuth(provider: string, workspaceId: string): Promise<void> {
		try {
			this.emit({ type: "oauth_initiated", provider, workspaceId });

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

			// Redirect to OAuth
			if (typeof window !== "undefined") {
				window.location.href = data.authUrl;
			}
		} catch (error) {
			this.emit({
				type: "oauth_completed",
				provider,
				workspaceId,
				success: false,
			});
			this.handleError(error, {
				action: "initiate_oauth",
				provider,
				workspaceId,
			});
		}
	}

	/**
	 * Handle database selection
	 */
	async selectDatabase(
		databaseId: string,
		workspaceId: string,
		importExisting: boolean = false,
	): Promise<void> {
		try {
			this.emit({ type: "database_selected", databaseId, workspaceId });

			const response = await fetch("/api/integrations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					workspaceId,
					provider: "notion",
					externalId: databaseId,
					config: {
						databaseId,
						importExisting,
					},
					syncEnabled: true,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to create integration");
			}

			const integration = await response.json();

			this.emit({
				type: "integration_created",
				integrationId: integration.id,
				workspaceId,
			});

			// Refresh integrations
			await this.loadIntegrations(workspaceId);
		} catch (error) {
			this.handleError(error, {
				action: "select_database",
				databaseId,
				workspaceId,
			});
		}
	}

	/**
	 * Handle integration disconnection
	 */
	async disconnectIntegration(
		integrationId: string,
		workspaceId: string,
	): Promise<void> {
		try {
			const response = await fetch(`/api/integrations/${integrationId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to disconnect integration");
			}

			this.emit({
				type: "integration_disconnected",
				integrationId,
				workspaceId,
			});

			// Refresh integrations
			await this.loadIntegrations(workspaceId);
		} catch (error) {
			this.handleError(error, {
				action: "disconnect_integration",
				integrationId,
				workspaceId,
			});
		}
	}

	/**
	 * Load integrations for workspace
	 */
	async loadIntegrations(workspaceId: string): Promise<void> {
		this.updateState({ loadingIntegrations: true });

		try {
			const response = await fetch(
				`/api/integrations?workspaceId=${workspaceId}`,
			);
			const data = await response.json();

			if (response.ok) {
				this.updateState({
					integrations: data.integrations || [],
					loadingIntegrations: false,
				});
			} else {
				throw new Error(data.error || "Failed to load integrations");
			}
		} catch (error) {
			this.updateState({ loadingIntegrations: false });
			this.handleError(error, { action: "load_integrations", workspaceId });
		}
	}

	/**
	 * Load databases with performance monitoring
	 */
	async loadDatabases(workspaceId: string): Promise<void> {
		const startTime = performance.now();
		this.updateState({ loadingDatabases: true });

		try {
			// Use cached databases if available
			const databases = await databaseCache.getDatabases(workspaceId);

			const duration = performance.now() - startTime;
			this.emit({
				type: "performance_measured",
				metric: "database_loading",
				duration,
				context: { workspaceId, databaseCount: databases?.length || 0 },
			});

			// Validate performance requirement (< 3 seconds)
			if (duration > 3000) {
				this.logger.logPerformanceWarning("database_loading", duration, 3000);
			}

			this.updateState({ loadingDatabases: false });
		} catch (error) {
			this.updateState({ loadingDatabases: false });
			this.handleError(error, { action: "load_databases", workspaceId });
		}
	}

	/**
	 * Handle guest user upgrade prompts
	 */
	showGuestUpgradePrompt(feature: string): void {
		this.updateState({ guestUpgradePromptOpen: true });
		this.emit({ type: "guest_upgrade_prompted", feature });
	}

	closeGuestUpgradePrompt(): void {
		this.updateState({ guestUpgradePromptOpen: false });
	}

	/**
	 * Handle account creation
	 */
	showAccountDialog(): void {
		this.updateState({ accountDialogOpen: true });
	}

	closeAccountDialog(): void {
		this.updateState({ accountDialogOpen: false });
	}

	/**
	 * Handle errors with proper propagation
	 */
	private handleError(error: unknown, context?: Record<string, unknown>): void {
		const errorId = handleApiError(error, context);

		// Add error to state
		const currentErrors = [...this.state.errors];
		if (!currentErrors.includes(errorId)) {
			currentErrors.push(errorId);
			this.updateState({ errors: currentErrors });
		}

		// Emit error event
		this.emit({ type: "error_occurred", error, context });
	}

	/**
	 * Preload resources for settings drawer
	 */
	private async preloadSettingsResources(workspaceId: string): Promise<void> {
		try {
			// Preload integration resources
			lazyLoader.preloadForTrigger("settingsOpen");

			// Preload databases if authenticated
			if (workspaceId) {
				databaseCache.preloadDatabases(workspaceId);
			}
		} catch (error) {
			console.warn("Failed to preload settings resources:", error);
		}
	}

	/**
	 * Update integration sync status
	 */
	private async updateIntegrationSync(
		provider: string,
		enabled: boolean,
		workspaceId: string,
	): Promise<void> {
		// Find the integration
		const integration = this.state.integrations.find(
			(i) => i.provider === provider,
		);
		if (!integration) {
			throw new Error(`No ${provider} integration found`);
		}

		const response = await fetch(`/api/integrations/${integration.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ syncEnabled: enabled }),
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || "Failed to update integration");
		}

		// Refresh integrations
		await this.loadIntegrations(workspaceId);

		// Refresh integration status
		await refreshIntegrationStatus(integration.id);
	}

	/**
	 * Handle state updates based on events
	 */
	private handleEventStateUpdate(event: ComponentEvent): void {
		switch (event.type) {
			case "oauth_completed":
				if (event.success) {
					this.updateState({ notionDialogOpen: true });
				}
				break;

			case "database_selected":
				this.updateState({ notionDialogOpen: false });
				break;

			case "integration_created":
			case "integration_disconnected":
				// State will be updated by loadIntegrations call
				break;

			case "error_occurred":
				// Error handling is done in handleError method
				break;
		}
	}

	/**
	 * Notify state listeners
	 */
	private notifyStateListeners(): void {
		this.listeners.forEach((listener) => {
			try {
				listener(this.state);
			} catch (error) {
				console.error("Error in state listener:", error);
			}
		});
	}
}

/**
 * Component logger for debugging and monitoring
 */
export class ComponentLogger {
	private logs: Array<{
		timestamp: Date;
		type: "event" | "state_change" | "performance" | "error";
		data: any;
	}> = [];

	private maxLogs = 1000;

	logEvent(event: ComponentEvent): void {
		this.addLog("event", event);

		// Console logging for development
		if (typeof console !== "undefined") {
			console.log(`[COMPONENT EVENT] ${event.type}`, event);
		}
	}

	logStateChange(
		previousState: ComponentState,
		newState: ComponentState,
	): void {
		const changes = this.getStateChanges(previousState, newState);
		if (Object.keys(changes).length > 0) {
			this.addLog("state_change", { changes, timestamp: new Date() });

			// Console logging for development
			if (typeof console !== "undefined") {
				console.log("[STATE CHANGE]", changes);
			}
		}
	}

	logPerformanceWarning(
		metric: string,
		actual: number,
		expected: number,
	): void {
		const warning = {
			metric,
			actual,
			expected,
			exceeded: actual - expected,
			timestamp: new Date(),
		};

		this.addLog("performance", warning);

		// Console warning
		if (typeof console !== "undefined") {
			console.warn(
				`[PERFORMANCE WARNING] ${metric}: ${actual}ms (expected < ${expected}ms)`,
			);
		}
	}

	logError(error: unknown, context?: Record<string, unknown>): void {
		const errorLog = {
			error:
				error instanceof Error
					? {
							name: error.name,
							message: error.message,
							stack: error.stack,
						}
					: error,
			context,
			timestamp: new Date(),
		};

		this.addLog("error", errorLog);

		// Console error
		if (typeof console !== "undefined") {
			console.error("[COMPONENT ERROR]", error, context);
		}
	}

	getLogs(): Array<{ timestamp: Date; type: string; data: any }> {
		return [...this.logs];
	}

	exportLogs(): string {
		return JSON.stringify(this.logs, null, 2);
	}

	clearLogs(): void {
		this.logs = [];
	}

	private addLog(
		type: "event" | "state_change" | "performance" | "error",
		data: any,
	): void {
		this.logs.unshift({
			timestamp: new Date(),
			type,
			data,
		});

		// Keep only the most recent logs
		if (this.logs.length > this.maxLogs) {
			this.logs = this.logs.slice(0, this.maxLogs);
		}
	}

	private getStateChanges(
		previous: ComponentState,
		current: ComponentState,
	): Record<string, { from: any; to: any }> {
		const changes: Record<string, { from: any; to: any }> = {};

		for (const key in current) {
			const currentValue = current[key as keyof ComponentState];
			const previousValue = previous[key as keyof ComponentState];

			if (JSON.stringify(currentValue) !== JSON.stringify(previousValue)) {
				changes[key] = {
					from: previousValue,
					to: currentValue,
				};
			}
		}

		return changes;
	}
}

/**
 * Global component wiring manager instance
 */
export const componentWiringManager = new ComponentWiringManager();

/**
 * Cleanup function for component unmounting
 */
export function createComponentCleanup(): () => void {
	const unsubscribers: Array<() => void> = [];

	return () => {
		unsubscribers.forEach((unsubscribe) => {
			try {
				unsubscribe();
			} catch (error) {
				console.error("Error during component cleanup:", error);
			}
		});
	};
}

/**
 * Hook for component integration with wiring manager
 */
export function useComponentWiring() {
	return {
		manager: componentWiringManager,
		subscribe: componentWiringManager.subscribe.bind(componentWiringManager),
		subscribeToEvents: componentWiringManager.subscribeToEvents.bind(
			componentWiringManager,
		),
		emit: componentWiringManager.emit.bind(componentWiringManager),
		updateState: componentWiringManager.updateState.bind(
			componentWiringManager,
		),
		getState: componentWiringManager.getState.bind(componentWiringManager),
		cleanup: createComponentCleanup,
	};
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
	private metrics = new Map<string, number[]>();

	measure<T>(name: string, operation: () => T): T;
	measure<T>(name: string, operation: () => Promise<T>): Promise<T>;
	measure<T>(name: string, operation: () => T | Promise<T>): T | Promise<T> {
		const startTime = performance.now();

		try {
			const result = operation();

			if (result instanceof Promise) {
				return result.finally(() => {
					this.recordMetric(name, performance.now() - startTime);
				});
			} else {
				this.recordMetric(name, performance.now() - startTime);
				return result;
			}
		} catch (error) {
			this.recordMetric(name, performance.now() - startTime);
			throw error;
		}
	}

	recordMetric(name: string, duration: number): void {
		if (!this.metrics.has(name)) {
			this.metrics.set(name, []);
		}

		const measurements = this.metrics.get(name)!;
		measurements.push(duration);

		// Keep only the last 100 measurements
		if (measurements.length > 100) {
			measurements.shift();
		}

		// Emit performance event
		componentWiringManager.emit({
			type: "performance_measured",
			metric: name,
			duration,
		});
	}

	getMetrics(): Record<
		string,
		{ avg: number; min: number; max: number; count: number }
	> {
		const result: Record<
			string,
			{ avg: number; min: number; max: number; count: number }
		> = {};

		for (const [name, measurements] of this.metrics.entries()) {
			if (measurements.length > 0) {
				result[name] = {
					avg:
						measurements.reduce((sum, val) => sum + val, 0) /
						measurements.length,
					min: Math.min(...measurements),
					max: Math.max(...measurements),
					count: measurements.length,
				};
			}
		}

		return result;
	}

	clearMetrics(): void {
		this.metrics.clear();
	}
}

/**
 * Global performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor();
