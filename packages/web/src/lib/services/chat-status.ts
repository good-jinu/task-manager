// Shared chat status storage
// In a real implementation, this would be stored in Redis or a database
export const chatStatuses = new Map<
	string,
	{
		completed: boolean;
		result?: unknown;
		error?: string;
		startTime: number;
	}
>();
