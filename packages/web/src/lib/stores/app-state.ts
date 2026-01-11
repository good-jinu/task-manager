import type { Task, Workspace } from "@notion-task-manager/db";
import { derived, type Readable, writable } from "svelte/store";

export interface AppState {
	// Core data
	tasks: Task[];
	currentWorkspace: Workspace | null;
	workspaces: Workspace[];

	// UI state
	loading: boolean;
	error: string;
	selectedContextTasks: Set<string>;

	// Dialog states
	showWorkspaceCreateDialog: boolean;

	// Guest state
	guestTaskCount: number;
	guestDaysRemaining: number;
}

const initialState: AppState = {
	tasks: [],
	currentWorkspace: null,
	workspaces: [],
	loading: false,
	error: "",
	selectedContextTasks: new Set(),
	showWorkspaceCreateDialog: false,
	guestTaskCount: 0,
	guestDaysRemaining: 7,
};

function createAppState() {
	const { subscribe, set, update } = writable<AppState>(initialState);

	return {
		subscribe,

		// Actions
		setTasks: (tasks: Task[]) => update((state) => ({ ...state, tasks })),

		setCurrentWorkspace: (workspace: Workspace | null) =>
			update((state) => ({ ...state, currentWorkspace: workspace })),

		setWorkspaces: (workspaces: Workspace[]) =>
			update((state) => ({ ...state, workspaces })),

		setLoading: (loading: boolean) =>
			update((state) => ({ ...state, loading })),

		setError: (error: string) => update((state) => ({ ...state, error })),

		toggleContextTask: (taskId: string) =>
			update((state) => {
				const newSelected = new Set(state.selectedContextTasks);
				if (newSelected.has(taskId)) {
					newSelected.delete(taskId);
				} else {
					newSelected.add(taskId);
				}
				return { ...state, selectedContextTasks: newSelected };
			}),

		clearContextTasks: () =>
			update((state) => ({ ...state, selectedContextTasks: new Set() })),

		setShowWorkspaceCreateDialog: (show: boolean) =>
			update((state) => ({ ...state, showWorkspaceCreateDialog: show })),

		updateGuestStats: (taskCount: number, daysRemaining: number = 7) =>
			update((state) => ({
				...state,
				guestTaskCount: taskCount,
				guestDaysRemaining: daysRemaining,
			})),

		// Bulk update
		updateState: (updates: Partial<AppState>) =>
			update((state) => ({ ...state, ...updates })),

		// Reset
		reset: () => set(initialState),
	};
}

export const appState = createAppState();

// Derived stores for commonly used computed values
export const contextTasks: Readable<Task[]> = derived(appState, ($appState) =>
	$appState.tasks.filter((task) => $appState.selectedContextTasks.has(task.id)),
);
