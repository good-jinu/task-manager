import { DatabaseConfigService } from "./database-config-service";
import { UserService } from "./user-service";

/**
 * Main database client that provides access to all services
 */
export class DatabaseClient {
	public readonly users: UserService;
	public readonly databaseConfigs: DatabaseConfigService;

	constructor() {
		this.users = new UserService();
		this.databaseConfigs = new DatabaseConfigService();
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
