// Main TaskFinder facade class

import type { SearchQuery } from "./agent/types.js";
import type { TaskSearchResult } from "./search/types.js";

export interface TaskFinder {
	search(query: SearchQuery): Promise<TaskSearchResult>;
	healthCheck(): Promise<boolean>;
}

// Placeholder implementation - will be implemented in later tasks
export class TaskFinderImpl implements TaskFinder {
	async search(query: SearchQuery): Promise<TaskSearchResult> {
		throw new Error("TaskFinder not yet implemented");
	}

	async healthCheck(): Promise<boolean> {
		throw new Error("Health check not yet implemented");
	}
}
