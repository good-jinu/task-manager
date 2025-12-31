// Export main database client
export { getDynamoDBClient, getTableNames } from "./client.js";
export { DatabaseClient, getDatabaseClient } from "./database.js";
// Export database config types from service
export type {
	CreateDatabaseConfigInput,
	DatabaseConfig,
} from "./database-config-service.js";
export { DatabaseConfigService } from "./database-config-service.js";
// Export search history types and service
export type {
	CreateSearchInput,
	SearchDoneData,
	SearchFailData,
	SearchHistoryRecord,
	SearchQuery,
	SearchResult,
} from "./search-history-service.js";
export { SearchHistoryService } from "./search-history-service.js";
// Export user types
export type {
	CreateUserInput,
	UpdateUserInput,
	User,
} from "./types.js";
export { UserService } from "./user-service.js";

// Export validation utilities
export { ValidationError } from "./validation.js";
