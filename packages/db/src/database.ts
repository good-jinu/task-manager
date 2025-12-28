import { TaskService } from "./task-service.js";
import { UserService } from "./user-service.js";

/**
 * Main database client that provides access to all services
 */
export class DatabaseClient {
	public readonly users: UserService;
	public readonly tasks: TaskService;

	constructor() {
		this.users = new UserService();
		this.tasks = new TaskService();
	}
}

/**
 * Singleton database client instance
 */
let databaseClient: DatabaseClient | null = null;

/**
 * Gets the database client, creating it if it doesn't exist
 */
export function getDatabaseClient(): DatabaseClient {
	if (!databaseClient) {
		databaseClient = new DatabaseClient();
	}
	return databaseClient;
}
