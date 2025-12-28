import {
	APIErrorCode,
	type Client,
	isFullPage,
	isNotionClientError,
} from "@notionhq/client";
import {
	type CreateTaskInput,
	type DatabaseConfig,
	type Task,
	type TaskFilter,
	type TaskPriority,
	TaskStatus,
	type UpdateTaskInput,
} from "./types.js";

export class NotionTaskManager {
	private client: Client;
	private config: DatabaseConfig;

	constructor(client: Client, config: DatabaseConfig) {
		this.client = client;
		this.config = config;
	}

	/**
	 * Create a new task in the Notion database
	 */
	async createTask(input: CreateTaskInput): Promise<Task> {
		try {
			const properties: any = {
				[this.config.titleProperty]: {
					title: [
						{
							text: {
								content: input.title,
							},
						},
					],
				},
			};

			// Add status
			if (this.config.statusProperty && input.status) {
				properties[this.config.statusProperty] = {
					select: {
						name: input.status,
					},
				};
			}

			// Add priority
			if (this.config.priorityProperty && input.priority) {
				properties[this.config.priorityProperty] = {
					select: {
						name: input.priority,
					},
				};
			}

			// Add due date
			if (this.config.dueDateProperty && input.dueDate) {
				properties[this.config.dueDateProperty] = {
					date: {
						start: input.dueDate.toISOString().split("T")[0],
					},
				};
			}

			// Add assignee
			if (this.config.assigneeProperty && input.assignee) {
				properties[this.config.assigneeProperty] = {
					rich_text: [
						{
							text: {
								content: input.assignee,
							},
						},
					],
				};
			}

			// Add tags
			if (this.config.tagsProperty && input.tags) {
				properties[this.config.tagsProperty] = {
					multi_select: input.tags.map((tag) => ({ name: tag })),
				};
			}

			const response = await this.client.pages.create({
				parent: {
					database_id: this.config.databaseId,
				},
				properties,
				children: input.description
					? [
							{
								object: "block",
								type: "paragraph",
								paragraph: {
									rich_text: [
										{
											type: "text",
											text: {
												content: input.description,
											},
										},
									],
								},
							},
						]
					: undefined,
			});

			return this.mapNotionPageToTask(response);
		} catch (error) {
			if (isNotionClientError(error)) {
				throw new Error(`Failed to create task: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Get all tasks from the database with optional filtering
	 */
	async getTasks(filter?: TaskFilter): Promise<Task[]> {
		try {
			const queryFilter: any = {};

			if (filter) {
				const conditions: Array<Record<string, unknown>> = [];

				if (filter.status && filter.status.length > 0) {
					conditions.push({
						property: this.config.statusProperty,
						select: {
							equals: filter.status[0], // For simplicity, using first status
						},
					});
				}

				if (filter.priority && filter.priority.length > 0) {
					conditions.push({
						property: this.config.priorityProperty,
						select: {
							equals: filter.priority[0],
						},
					});
				}

				if (conditions.length > 0) {
					queryFilter.filter =
						conditions.length === 1
							? conditions[0]
							: {
									and: conditions,
								};
				}
			}

			const response = await this.client.databases.query({
				database_id: this.config.databaseId,
				...queryFilter,
			});

			return response.results
				.filter(isFullPage)
				.map((page) => this.mapNotionPageToTask(page));
		} catch (error) {
			if (isNotionClientError(error)) {
				throw new Error(`Failed to get tasks: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Get a specific task by ID
	 */
	async getTask(taskId: string): Promise<Task | null> {
		try {
			const response = await this.client.pages.retrieve({
				page_id: taskId,
			});

			if (isFullPage(response)) {
				return this.mapNotionPageToTask(response);
			}
			return null;
		} catch (error) {
			if (isNotionClientError(error)) {
				if (error.code === APIErrorCode.ObjectNotFound) {
					return null;
				}
				throw new Error(`Failed to get task: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Update an existing task
	 */
	async updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
		try {
			const properties: any = {};

			if (input.title) {
				properties[this.config.titleProperty] = {
					title: [
						{
							text: {
								content: input.title,
							},
						},
					],
				};
			}

			if (input.status && this.config.statusProperty) {
				properties[this.config.statusProperty] = {
					select: {
						name: input.status,
					},
				};
			}

			if (input.priority && this.config.priorityProperty) {
				properties[this.config.priorityProperty] = {
					select: {
						name: input.priority,
					},
				};
			}

			if (input.dueDate && this.config.dueDateProperty) {
				properties[this.config.dueDateProperty] = {
					date: {
						start: input.dueDate.toISOString().split("T")[0],
					},
				};
			}

			if (input.assignee && this.config.assigneeProperty) {
				properties[this.config.assigneeProperty] = {
					rich_text: [
						{
							text: {
								content: input.assignee,
							},
						},
					],
				};
			}

			if (input.tags && this.config.tagsProperty) {
				properties[this.config.tagsProperty] = {
					multi_select: input.tags.map((tag) => ({ name: tag })),
				};
			}

			const response = await this.client.pages.update({
				page_id: taskId,
				properties,
			});

			return this.mapNotionPageToTask(response);
		} catch (error) {
			if (isNotionClientError(error)) {
				throw new Error(`Failed to update task: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Delete a task
	 */
	async deleteTask(taskId: string): Promise<void> {
		try {
			await this.client.pages.update({
				page_id: taskId,
				archived: true,
			});
		} catch (error) {
			if (isNotionClientError(error)) {
				throw new Error(`Failed to delete task: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Map a Notion page to our Task interface
	 */
	private mapNotionPageToTask(page: any): Task {
		const properties = page.properties as Record<string, any>;

		const title = this.extractTextFromProperty(
			properties[this.config.titleProperty],
		);
		const status = this.config.statusProperty
			? (this.extractSelectFromProperty(
					properties[this.config.statusProperty],
				) as TaskStatus)
			: undefined;
		const priority = this.config.priorityProperty
			? (this.extractSelectFromProperty(
					properties[this.config.priorityProperty],
				) as TaskPriority)
			: undefined;
		const dueDate = this.config.dueDateProperty
			? this.extractDateFromProperty(properties[this.config.dueDateProperty])
			: undefined;
		const assignee = this.config.assigneeProperty
			? this.extractTextFromProperty(properties[this.config.assigneeProperty])
			: undefined;
		const tags = this.config.tagsProperty
			? this.extractMultiSelectFromProperty(
					properties[this.config.tagsProperty],
				)
			: undefined;

		return {
			id: page.id as string,
			title: title || "Untitled",
			status: status || TaskStatus.TODO,
			priority,
			dueDate,
			assignee,
			tags,
			createdAt: new Date(page.created_time as string),
			updatedAt: new Date(page.last_edited_time as string),
		};
	}

	private extractTextFromProperty(property: unknown): string | undefined {
		if (!property || typeof property !== "object" || property === null)
			return undefined;

		const prop = property as Record<string, unknown>;

		if (
			prop.type === "title" &&
			Array.isArray(prop.title) &&
			prop.title.length > 0
		) {
			const titleItem = prop.title[0] as Record<string, unknown>;
			return titleItem?.plain_text as string;
		}

		if (
			prop.type === "rich_text" &&
			Array.isArray(prop.rich_text) &&
			prop.rich_text.length > 0
		) {
			const richTextItem = prop.rich_text[0] as Record<string, unknown>;
			return richTextItem?.plain_text as string;
		}

		return undefined;
	}

	private extractSelectFromProperty(property: unknown): string | undefined {
		if (!property || typeof property !== "object" || property === null)
			return undefined;

		const prop = property as Record<string, unknown>;
		if (prop.type !== "select") return undefined;

		const select = prop.select as Record<string, unknown> | null;
		return select?.name as string | undefined;
	}

	private extractDateFromProperty(property: unknown): Date | undefined {
		if (!property || typeof property !== "object" || property === null)
			return undefined;

		const prop = property as Record<string, unknown>;
		if (prop.type !== "date") return undefined;

		const date = prop.date as Record<string, unknown> | null;
		return date?.start ? new Date(date.start as string) : undefined;
	}

	private extractMultiSelectFromProperty(
		property: unknown,
	): string[] | undefined {
		if (!property || typeof property !== "object" || property === null)
			return undefined;

		const prop = property as Record<string, unknown>;
		if (prop.type !== "multi_select") return undefined;

		const multiSelect = prop.multi_select as Array<Record<string, unknown>>;
		return multiSelect?.map((item) => item.name as string) || [];
	}
}
