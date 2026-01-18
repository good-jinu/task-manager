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
	console.log("[initializeAuthenticatedUser] Starting initialization", {
		userId: session.user?.id,
		isNewUser: session.user?.isNewUser,
	});

	try {
		// Load workspaces
		const workspaces = await loadWorkspaces();
		console.log("[initializeAuthenticatedUser] Workspaces loaded", {
			count: workspaces.length,
		});
		appState.setWorkspaces(workspaces);

		let currentWorkspace = workspaces.length > 0 ? workspaces[0] : null;

		// Create default workspace if none exist
		if (!currentWorkspace) {
			console.log(
				"[initializeAuthenticatedUser] No workspaces found, creating default",
			);
			currentWorkspace = await createDefaultWorkspace();
			appState.setWorkspaces([currentWorkspace]);
		}

		appState.setCurrentWorkspace(currentWorkspace);
		manager.updateState({ currentWorkspace });

		// Load tasks and integrations for the current workspace
		if (currentWorkspace) {
			console.log("[initializeAuthenticatedUser] Loading workspace data", {
				workspaceId: currentWorkspace.id,
			});
			await loadWorkspaceData(currentWorkspace.id);
		}

		// Handle pending guest data migration
		const pendingMigration =
			browser && localStorage.getItem("pending_migration") === "true";
		console.log(
			"[initializeAuthenticatedUser] Checking for pending migration",
			{
				pendingMigration,
				isNewUser: session.user?.isNewUser,
			},
		);

		if (pendingMigration) {
			const migrationSuccess = await handlePendingMigration(
				session.user?.isNewUser || false,
			);

			console.log("[initializeAuthenticatedUser] Migration result", {
				success: migrationSuccess,
			});

			if (migrationSuccess) {
				console.log(
					"[initializeAuthenticatedUser] Reloading workspaces after migration",
				);
				// Reload workspaces after migration
				const updatedWorkspaces = await loadWorkspaces();
				console.log("[initializeAuthenticatedUser] Updated workspaces loaded", {
					count: updatedWorkspaces.length,
				});
				appState.setWorkspaces(updatedWorkspaces);

				if (updatedWorkspaces.length > 0) {
					const newCurrentWorkspace = updatedWorkspaces[0];
					console.log(
						"[initializeAuthenticatedUser] Setting migrated workspace as current",
						{
							workspaceId: newCurrentWorkspace.id,
						},
					);
					appState.setCurrentWorkspace(newCurrentWorkspace);
					await loadWorkspaceData(newCurrentWorkspace.id);
				}
			}
		}

		console.log("[initializeAuthenticatedUser] Initialization complete");
	} catch (error) {
		console.error("[initializeAuthenticatedUser] Failed to initialize:", error);
		appState.setError("Failed to initialize workspace");
	}
}

/**
 * Initialize guest user
 */
async function initializeGuestUser(): Promise<void> {
	console.log("[initializeGuestUser] Starting guest initialization");
	appState.setLoading(true);

	try {
		const result = await guestUserService.recoverGuestSession();
		console.log("[initializeGuestUser] Recovery result:", {
			success: result.success,
			hasWorkspace: !!result.workspace,
			taskCount: result.tasks.length,
			message: result.message,
		});

		if (result.success && result.workspace) {
			appState.setCurrentWorkspace(result.workspace);
			appState.setTasks(result.tasks);
			appState.updateGuestStats(result.tasks.length);

			guestUserService.updateGuestStore(result.workspace, result.tasks);
			manager.updateState({
				currentWorkspace: result.workspace,
				tasks: result.tasks,
			});
			console.log("[initializeGuestUser] Guest user initialized successfully");
		} else {
			console.error(
				"[initializeGuestUser] Failed to initialize:",
				result.message,
			);
			appState.setError(result.message || "Failed to initialize workspace");
		}
	} catch (error) {
		console.error("[initializeGuestUser] Exception during setup:", error);
		appState.setError("Failed to initialize workspace");
	} finally {
		appState.setLoading(false);
		console.log("[initializeGuestUser] Initialization complete");
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
	console.log("[initializeApp] Starting app initialization", {
		isAuthenticated: !!session,
	});

	await performanceMonitor.measure("app_initialization", async () => {
		const isAuthenticated = !!session;

		if (isAuthenticated) {
			console.log("[initializeApp] Initializing authenticated user");
			await initializeAuthenticatedUser(session);
		} else {
			console.log("[initializeApp] Initializing guest user");
			await initializeGuestUser();
		}

		// Handle URL parameters for both authenticated and guest users
		handleURLParameters();
		console.log("[initializeApp] App initialization complete");
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
