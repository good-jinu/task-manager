// Export main database client
export { getDynamoDBClient, getTableNames } from "./client";
export { DatabaseClient, getDatabaseClient } from "./database";
// Export database config types from service
export type {
	CreateDatabaseConfigInput,
	DatabaseConfig,
} from "./database-config-service";
export { DatabaseConfigService } from "./database-config-service";
// Export search history types and service
export type {
	CreateSearchInput,
	SearchDoneData,
	SearchFailData,
	SearchHistoryRecord,
	SearchQuery,
	SearchResult,
} from "./search-history-service";
export { SearchHistoryService } from "./search-history-service";
// Export user types
export type {
	CreateUserInput,
	UpdateUserInput,
	User,
} from "./types";
export { UserService } from "./user-service";

// Export validation utilities
export { ValidationError } from "./validation";
