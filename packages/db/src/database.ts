import { DatabaseConfigService } from "./database-config-service";
import { GuestUserService } from "./guest-user-service";
import { IntegrationService } from "./integration-service";
import { MigrationService } from "./migration-service";
import type { NotionTaskManagerInterface } from "./notion-adapter";
import { NotionAdapter } from "./notion-adapter";
import { SyncMetadataService } from "./sync-metadata-service";
import { SyncService } from "./sync-service";
import { TaskService } from "./task-service";
import { UserService } from "./user-service";
import { WorkspaceService } from "./workspace-service";

/**
 * Main database client that provides access to all services
 */
export class DatabaseClient {
	public readonly users: UserService;
	public readonly databaseConfigs: DatabaseConfigService;
	public readonly tasks: TaskService;
	public readonly workspaces: WorkspaceService;
	public readonly integrations: IntegrationService;
	public readonly syncMetadata: SyncMetadataService;
	public readonly guestUsers: GuestUserService;
	public readonly sync: SyncService;
	public readonly migration: MigrationService;

	constructor(notionTaskManager?: NotionTaskManagerInterface) {
		this.users = new UserService();
		this.databaseConfigs = new DatabaseConfigService();
		this.tasks = new TaskService();
		this.workspaces = new WorkspaceService();
		this.integrations = new IntegrationService();
		this.syncMetadata = new SyncMetadataService();
		this.guestUsers = new GuestUserService();

		// Initialize sync service with dependencies
		this.sync = new SyncService(
			this.syncMetadata,
			this.tasks,
			this.integrations,
		);

		// Register Notion adapter if NotionTaskManager is provided
		if (notionTaskManager) {
			const notionAdapter = new NotionAdapter(notionTaskManager);
			this.sync.registerAdapter(notionAdapter);

			// Initialize migration service with NotionTaskManager
			this.migration = new MigrationService(
				notionTaskManager,
				this.tasks,
				this.workspaces,
				this.syncMetadata,
				this.integrations,
			);
		} else {
			// Initialize migration service without NotionTaskManager (will need to be provided later)
			this.migration = new MigrationService(
				null, // Will be set later when NotionTaskManager is available
				this.tasks,
				this.workspaces,
				this.syncMetadata,
				this.integrations,
			);
		}
	}

	/**
	 * Register a NotionTaskManager and set up Notion-related services
	 */
	setNotionTaskManager(notionTaskManager: NotionTaskManagerInterface): void {
		const notionAdapter = new NotionAdapter(notionTaskManager);
		this.sync.registerAdapter(notionAdapter);

		// Update migration service with NotionTaskManager
		this.migration.notionTaskManager = notionTaskManager;
	}
}

/**
 * Singleton database client instance
 */
let databaseClient: DatabaseClient | null = null;

/**
 * Gets the database client, creating it if it doesn't exist
 */
export function getDatabaseClient(
	notionTaskManager?: NotionTaskManagerInterface,
): DatabaseClient {
	if (!databaseClient) {
		databaseClient = new DatabaseClient(notionTaskManager);
	} else if (notionTaskManager) {
		// Update existing client with NotionTaskManager if provided
		databaseClient.setNotionTaskManager(notionTaskManager);
	}
	return databaseClient;
}
