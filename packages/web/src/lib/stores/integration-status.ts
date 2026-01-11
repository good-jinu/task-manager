import { derived, type Readable, writable } from "svelte/store";
import {
	type IntegrationStatus,
	type IntegrationStatusData,
	integrationStatusManager,
	type SyncStatistics,
} from "$lib/utils/integration-status";

interface IntegrationStatusStore {
	[integrationId: string]: IntegrationStatusData | null;
}

interface WorkspaceStatusStore {
	[workspaceId: string]: IntegrationStatusData[];
}

// Store for individual integration statuses
const integrationStatusStore = writable<IntegrationStatusStore>({});

// Store for workspace-level integration statuses
const workspaceStatusStore = writable<WorkspaceStatusStore>({});

// Store for loading states
const loadingStore = writable<{ [key: string]: boolean }>({});

// Store for error states
const errorStore = writable<{ [key: string]: string | null }>({});

/**
 * Get reactive status for a specific integration
 */
export function createIntegrationStatusStore(
	workspaceId: string,
	integrationId: string,
	autoRefresh = true,
): {
	status: Readable<IntegrationStatus | null>;
	stats: Readable<SyncStatistics | null>;
	loading: Readable<boolean>;
	error: Readable<string | null>;
	refresh: () => Promise<void>;
	startPolling: () => void;
	stopPolling: () => void;
} {
	const key = `${workspaceId}:${integrationId}`;
	let unsubscribe: (() => void) | null = null;

	// Initialize loading state
	loadingStore.update((state) => ({ ...state, [key]: false }));
	errorStore.update((state) => ({ ...state, [key]: null }));

	// Subscribe to status manager updates
	if (autoRefresh) {
		unsubscribe = integrationStatusManager.subscribe(
			workspaceId,
			integrationId,
			(data) => {
				integrationStatusStore.update((state) => ({
					...state,
					[integrationId]: data,
				}));
				loadingStore.update((state) => ({ ...state, [key]: false }));
				errorStore.update((state) => ({ ...state, [key]: null }));
			},
		);
	}

	// Derived stores
	const status = derived(
		integrationStatusStore,
		($store) => $store[integrationId]?.status || null,
	);

	const stats = derived(
		integrationStatusStore,
		($store) => $store[integrationId]?.stats || null,
	);

	const loading = derived(loadingStore, ($store) => $store[key] || false);

	const error = derived(errorStore, ($store) => $store[key] || null);

	// Actions
	const refresh = async () => {
		loadingStore.update((state) => ({ ...state, [key]: true }));
		errorStore.update((state) => ({ ...state, [key]: null }));

		try {
			const data = await integrationStatusManager.getStatus(
				workspaceId,
				integrationId,
				true,
			);

			if (data) {
				integrationStatusStore.update((state) => ({
					...state,
					[integrationId]: data,
				}));
			} else {
				errorStore.update((state) => ({
					...state,
					[key]: "Failed to fetch integration status",
				}));
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			errorStore.update((state) => ({ ...state, [key]: errorMessage }));
		} finally {
			loadingStore.update((state) => ({ ...state, [key]: false }));
		}
	};

	const startPolling = () => {
		integrationStatusManager.startPolling(workspaceId, integrationId);
	};

	const stopPolling = () => {
		integrationStatusManager.stopPolling(workspaceId, integrationId);
		if (unsubscribe) {
			unsubscribe();
			unsubscribe = null;
		}
	};

	// Initial load
	if (autoRefresh) {
		refresh();
	}

	return {
		status,
		stats,
		loading,
		error,
		refresh,
		startPolling,
		stopPolling,
	};
}

/**
 * Get reactive status for all integrations in a workspace
 */
export function createWorkspaceStatusStore(
	workspaceId: string,
	autoRefresh = true,
): {
	integrations: Readable<IntegrationStatusData[]>;
	loading: Readable<boolean>;
	error: Readable<string | null>;
	refresh: () => Promise<void>;
	startPolling: () => void;
	stopPolling: () => void;
} {
	const key = `workspace:${workspaceId}`;

	// Initialize loading state
	loadingStore.update((state) => ({ ...state, [key]: false }));
	errorStore.update((state) => ({ ...state, [key]: null }));

	// Derived stores
	const integrations = derived(
		workspaceStatusStore,
		($store) => $store[workspaceId] || [],
	);

	const loading = derived(loadingStore, ($store) => $store[key] || false);

	const error = derived(errorStore, ($store) => $store[key] || null);

	// Actions
	const refresh = async () => {
		loadingStore.update((state) => ({ ...state, [key]: true }));
		errorStore.update((state) => ({ ...state, [key]: null }));

		try {
			const data = await integrationStatusManager.getAllStatuses(
				workspaceId,
				true,
			);

			workspaceStatusStore.update((state) => ({
				...state,
				[workspaceId]: data,
			}));

			// Also update individual integration stores
			for (const item of data) {
				if (item.integration) {
					integrationStatusStore.update((state) => ({
						...state,
						[item.integration?.databaseId || "unknown"]: item,
					}));
				}
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			errorStore.update((state) => ({ ...state, [key]: errorMessage }));
		} finally {
			loadingStore.update((state) => ({ ...state, [key]: false }));
		}
	};

	const startPolling = () => {
		integrationStatusManager.startPolling(workspaceId);
	};

	const stopPolling = () => {
		integrationStatusManager.stopPolling(workspaceId);
	};

	// Initial load
	if (autoRefresh) {
		refresh();
	}

	return {
		integrations,
		loading,
		error,
		refresh,
		startPolling,
		stopPolling,
	};
}

/**
 * Manual refresh action for integration status
 */
export async function refreshIntegrationStatus(
	integrationId: string,
): Promise<boolean> {
	const key = `refresh:${integrationId}`;

	loadingStore.update((state) => ({ ...state, [key]: true }));
	errorStore.update((state) => ({ ...state, [key]: null }));

	try {
		const success = await integrationStatusManager.refreshStatus(integrationId);

		if (!success) {
			errorStore.update((state) => ({
				...state,
				[key]: "Failed to refresh integration status",
			}));
		}

		return success;
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : "Unknown error";
		errorStore.update((state) => ({ ...state, [key]: errorMessage }));
		return false;
	} finally {
		loadingStore.update((state) => ({ ...state, [key]: false }));
	}
}

/**
 * Clear all status data (useful for logout/cleanup)
 */
export function clearAllStatus(): void {
	integrationStatusStore.set({});
	workspaceStatusStore.set({});
	loadingStore.set({});
	errorStore.set({});
}
