import { randomUUID } from "node:crypto";
import {
	GetCommand,
	PutCommand,
	ScanCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient, getTableNames } from "./client";
import { TaskService } from "./task-service";
import type { GuestUser, MigrationError, MigrationResult } from "./types";
import { validateUserId } from "./validation";
import { WorkspaceService } from "./workspace-service";

export class GuestUserService {
	private client = getDynamoDBClient();
	private tableName = getTableNames().guestUsers;
	private workspaceService = new WorkspaceService();
	private taskService = new TaskService();

	/**
	 * Generates a unique guest user ID
	 */
	generateGuestId(): string {
		return `guest_${randomUUID()}`;
	}

	/**
	 * Creates a guest user record with TTL
	 */
	async createGuestUser(guestId?: string): Promise<GuestUser> {
		const id = guestId || this.generateGuestId();
		const now = new Date();
		const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

		const guestUser: GuestUser = {
			id,
			createdAt: now.toISOString(),
			expiresAt: expiresAt.toISOString(),
			migrated: false,
		};

		try {
			await this.client.send(
				new PutCommand({
					TableName: this.tableName,
					Item: guestUser,
					// Prevent overwriting existing guest users
					ConditionExpression: "attribute_not_exists(id)",
				}),
			);

			return guestUser;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to create guest user: ${error.message}`);
			}
			throw new Error("Failed to create guest user: Unknown error");
		}
	}

	/**
	 * Gets a guest user by ID
	 */
	async getGuestUser(guestId: string): Promise<GuestUser | null> {
		if (
			!guestId ||
			typeof guestId !== "string" ||
			guestId.trim().length === 0
		) {
			throw new Error("Guest ID is required and cannot be empty");
		}

		try {
			const result = await this.client.send(
				new GetCommand({
					TableName: this.tableName,
					Key: { id: guestId },
				}),
			);

			return (result.Item as GuestUser) || null;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to get guest user: ${error.message}`);
			}
			throw new Error("Failed to get guest user: Unknown error");
		}
	}

	/**
	 * Creates a default workspace for a guest user
	 */
	async createGuestWorkspace(guestId: string): Promise<string> {
		if (
			!guestId ||
			typeof guestId !== "string" ||
			guestId.trim().length === 0
		) {
			throw new Error("Guest ID is required and cannot be empty");
		}

		try {
			// Create a default workspace for the guest user
			const workspace = await this.workspaceService.createWorkspace(guestId, {
				name: "My Tasks",
				description: "Default workspace for guest user",
			});

			return workspace.id;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to create guest workspace: ${error.message}`);
			}
			throw new Error("Failed to create guest workspace: Unknown error");
		}
	}

	/**
	 * Migrates guest tasks to a permanent user account
	 */
	async migrateGuestTasks(
		guestId: string,
		permanentUserId: string,
	): Promise<MigrationResult> {
		// Validate inputs
		if (
			!guestId ||
			typeof guestId !== "string" ||
			guestId.trim().length === 0
		) {
			throw new Error("Guest ID is required and cannot be empty");
		}
		validateUserId(permanentUserId);

		const migrationId = randomUUID();
		const errors: MigrationError[] = [];
		let successCount = 0;
		let totalTasks = 0;

		try {
			// Get all workspaces for the guest user
			const guestWorkspaces =
				await this.workspaceService.listWorkspaces(guestId);

			if (guestWorkspaces.length === 0) {
				return {
					migrationId,
					workspaceId: "",
					totalTasks: 0,
					successCount: 0,
					failureCount: 0,
					errors: [],
				};
			}

			// Create a new workspace for the permanent user
			const newWorkspace = await this.workspaceService.createWorkspace(
				permanentUserId,
				{
					name: "Migrated Tasks",
					description: "Tasks migrated from guest account",
				},
			);

			// Migrate tasks from all guest workspaces to the new workspace
			for (const guestWorkspace of guestWorkspaces) {
				try {
					// Get all tasks in the guest workspace
					let hasMore = true;
					let cursor: string | undefined;

					while (hasMore) {
						const result = await this.taskService.listTasks(guestWorkspace.id, {
							limit: 100,
							cursor,
						});

						totalTasks += result.items.length;

						// Migrate each task
						for (const task of result.items) {
							try {
								await this.taskService.createTask({
									workspaceId: newWorkspace.id,
									title: task.title,
									content: task.content,
									status: task.status,
									priority: task.priority,
									dueDate: task.dueDate,
								});
								successCount++;
							} catch (error) {
								errors.push({
									notionPageId: task.id, // Using task ID as identifier
									error:
										error instanceof Error ? error.message : "Unknown error",
								});
							}
						}

						hasMore = result.hasMore;
						cursor = result.nextCursor;
					}

					// Delete the guest workspace after migration
					await this.workspaceService.deleteWorkspace(
						guestWorkspace.id,
						"delete",
					);
				} catch (error) {
					errors.push({
						notionPageId: guestWorkspace.id,
						error: `Failed to migrate workspace: ${error instanceof Error ? error.message : "Unknown error"}`,
					});
				}
			}

			// Mark the guest user as migrated
			await this.markGuestAsMigrated(guestId);

			return {
				migrationId,
				workspaceId: newWorkspace.id,
				totalTasks,
				successCount,
				failureCount: totalTasks - successCount,
				errors,
			};
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to migrate guest tasks: ${error.message}`);
			}
			throw new Error("Failed to migrate guest tasks: Unknown error");
		}
	}

	/**
	 * Marks a guest user as migrated
	 */
	private async markGuestAsMigrated(guestId: string): Promise<void> {
		try {
			await this.client.send(
				new UpdateCommand({
					TableName: this.tableName,
					Key: { id: guestId },
					UpdateExpression: "SET migrated = :migrated",
					ExpressionAttributeValues: {
						":migrated": true,
					},
					ConditionExpression: "attribute_exists(id)",
				}),
			);
		} catch (error) {
			// Log error but don't fail the migration
			console.error(`Failed to mark guest ${guestId} as migrated:`, error);
		}
	}

	/**
	 * Cleans up expired guest users and their data
	 */
	async cleanupExpiredGuests(): Promise<void> {
		try {
			const now = new Date().toISOString();

			// Scan for expired guest users
			const result = await this.client.send(
				new ScanCommand({
					TableName: this.tableName,
					FilterExpression: "expiresAt < :now AND migrated = :migrated",
					ExpressionAttributeValues: {
						":now": now,
						":migrated": false,
					},
				}),
			);

			const expiredGuests = (result.Items as GuestUser[]) || [];

			// Clean up each expired guest
			for (const guest of expiredGuests) {
				try {
					// Delete all workspaces and tasks for this guest
					const workspaces = await this.workspaceService.listWorkspaces(
						guest.id,
					);
					for (const workspace of workspaces) {
						await this.workspaceService.deleteWorkspace(workspace.id, "delete");
					}

					// The guest user record will be automatically deleted by DynamoDB TTL
				} catch (error) {
					console.error(`Failed to cleanup guest ${guest.id}:`, error);
				}
			}
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to cleanup expired guests: ${error.message}`);
			}
			throw new Error("Failed to cleanup expired guests: Unknown error");
		}
	}
}
