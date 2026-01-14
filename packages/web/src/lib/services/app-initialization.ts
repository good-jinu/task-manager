import type { Session } from "@auth/sveltekit";
import type { Workspace } from "@task-manager/db";
import { get } from "svelte/store";
import { browser } from "$app/environment";
import { type AppState, appState } from "$lib/stores/app-state";
import {
	performanceMonitor,
	useComponentWiring,
} from "$lib/utils/component-wiring";
import { urlParamHandler } from "$lib/utils/url-params";
import { guestUserService } from "./guest-user-service";
import { handlePendingMigration } from "./migration-service";
import { taskService } from "./task-service";
import {
	createDefaultWorkspace,
	createWorkspace,
	loadWorkspaces,
} from "./workspace-service";

const manager = useComponentWiring().manager;

/**
 * Load workspace-specific data (tasks and integrations)
 */
async function loadWorkspaceData(workspaceId: string): Promise<void> {
	try {
		// Load tasks
		const tasks = await taskService.fetchTasks(workspaceId);
		appState.setTasks(tasks);
		manager.updateState({ tasks });

		// Load integrations
		await manager.loadIntegrations(workspaceId);
	} catch (error) {
		console.error("Failed to load workspace data:", error);
		appState.setError("Failed to load workspace data");
	}
}

/**
 * Initialize authenticated user
 */
async function initializeAuthenticatedUser(session: Session): Promise<void> {
	try {
		// Load workspaces
		const workspaces = await loadWorkspaces();
		appState.setWorkspaces(workspaces);

		let currentWorkspace = workspaces.length > 0 ? workspaces[0] : null;

		// Create default workspace if none exist
		if (!currentWorkspace) {
			currentWorkspace = await createDefaultWorkspace();
			appState.setWorkspaces([currentWorkspace]);
		}

		appState.setCurrentWorkspace(currentWorkspace);
		manager.updateState({ currentWorkspace });

		// Load tasks and integrations for the current workspace
		if (currentWorkspace) {
			await loadWorkspaceData(currentWorkspace.id);
		}

		// Handle pending guest data migration
		if (browser && localStorage.getItem("pending_migration") === "true") {
			const migrationSuccess = await handlePendingMigration(
				session.user?.isNewUser || false,
			);

			if (migrationSuccess) {
				// Reload workspaces after migration
				const updatedWorkspaces = await loadWorkspaces();
				appState.setWorkspaces(updatedWorkspaces);

				if (updatedWorkspaces.length > 0) {
					const newCurrentWorkspace = updatedWorkspaces[0];
					appState.setCurrentWorkspace(newCurrentWorkspace);
					await loadWorkspaceData(newCurrentWorkspace.id);
				}
			}
		}
	} catch (error) {
		console.error("Failed to initialize authenticated user:", error);
		appState.setError("Failed to initialize workspace");
	}
}

/**
 * Initialize guest user
 */
async function initializeGuestUser(): Promise<void> {
	appState.setLoading(true);

	try {
		const result = await guestUserService.recoverGuestSession();

		if (result.success && result.workspace) {
			appState.setCurrentWorkspace(result.workspace);
			appState.setTasks(result.tasks);
			appState.updateGuestStats(result.tasks.length);

			guestUserService.updateGuestStore(result.workspace, result.tasks);
			manager.updateState({
				currentWorkspace: result.workspace,
				tasks: result.tasks,
			});
		} else {
			appState.setError(result.message || "Failed to initialize workspace");
		}
	} catch (error) {
		console.error("Failed to setup guest session:", error);
		appState.setError("Failed to initialize workspace");
	} finally {
		appState.setLoading(false);
	}
}

/**
 * Handle URL parameters for navigation and OAuth callbacks
 */
function handleURLParameters(): void {
	if (!browser) return;

	const params = urlParamHandler.parseParams();

	// Handle signup parameter
	urlParamHandler.handleSignupParam(params, () => {
		manager.showAccountDialog();
	});
}

/**
 * Initialize the application based on authentication status
 */
export async function initializeApp(session: Session | null): Promise<void> {
	await performanceMonitor.measure("app_initialization", async () => {
		const isAuthenticated = !!session;

		if (isAuthenticated) {
			await initializeAuthenticatedUser(session);
		} else {
			await initializeGuestUser();
		}

		// Handle URL parameters for both authenticated and guest users
		handleURLParameters();
	});
}

/**
 * Handle workspace change
 */
export async function handleWorkspaceChange(
	workspaceId: string,
): Promise<void> {
	// Get current state using Svelte's get() function
	const currentState = get(appState);

	const selectedWorkspace = currentState.workspaces.find(
		(w: Workspace) => w.id === workspaceId,
	);

	if (
		selectedWorkspace &&
		selectedWorkspace.id !== currentState.currentWorkspace?.id
	) {
		appState.setCurrentWorkspace(selectedWorkspace);
		manager.updateState({ currentWorkspace: selectedWorkspace });
		await loadWorkspaceData(selectedWorkspace.id);
	}
}

/**
 * Handle workspace creation
 */
export async function handleCreateWorkspace(
	name: string,
	description?: string,
): Promise<void> {
	try {
		const newWorkspace = await createWorkspace(name, description);

		// Get current state using Svelte's get() function
		const currentState = get(appState);

		const updatedWorkspaces = [...currentState.workspaces, newWorkspace];
		appState.setWorkspaces(updatedWorkspaces);
		appState.setCurrentWorkspace(newWorkspace);
		manager.updateState({ currentWorkspace: newWorkspace });

		await loadWorkspaceData(newWorkspace.id);
	} catch (error) {
		console.error("Error creating workspace:", error);
		throw error;
	}
}
