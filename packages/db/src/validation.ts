import type {
	CreateIntegrationInput,
	CreateSyncMetadataInput,
	CreateTaskInput,
	CreateUserInput,
	CreateWorkspaceInput,
	UpdateIntegrationInput,
	UpdateSyncMetadataInput,
	UpdateTaskInput,
	UpdateUserInput,
	UpdateWorkspaceInput,
} from "./types";

/**
 * Validation error class for input validation failures
 */
export class ValidationError extends Error {
	constructor(
		message: string,
		public field?: string,
	) {
		super(message);
		this.name = "ValidationError";
	}
}

/**
 * Validates email format
 */
function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Validates that a string is not empty or just whitespace
 */
function isNonEmptyString(value: string): boolean {
	return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates user creation input
 */
export function validateCreateUserInput(input: CreateUserInput): void {
	if (!input.notionUserId || !isNonEmptyString(input.notionUserId)) {
		throw new ValidationError(
			"Notion user ID is required and cannot be empty",
			"notionUserId",
		);
	}

	if (!input.email || !isNonEmptyString(input.email)) {
		throw new ValidationError("Email is required and cannot be empty", "email");
	}

	if (!isValidEmail(input.email)) {
		throw new ValidationError("Email must be a valid email address", "email");
	}

	if (!input.name || !isNonEmptyString(input.name)) {
		throw new ValidationError("Name is required and cannot be empty", "name");
	}

	if (!input.notionAccessToken || !isNonEmptyString(input.notionAccessToken)) {
		throw new ValidationError(
			"Notion access token is required and cannot be empty",
			"notionAccessToken",
		);
	}

	// Optional fields validation
	if (
		input.avatarUrl !== undefined &&
		input.avatarUrl !== null &&
		!isNonEmptyString(input.avatarUrl)
	) {
		throw new ValidationError(
			"Avatar URL cannot be empty if provided",
			"avatarUrl",
		);
	}
}

/**
 * Validates user update input
 */
export function validateUpdateUserInput(input: UpdateUserInput): void {
	// Check that at least one field is provided for update
	const hasValidUpdate = Object.values(input).some(
		(value) => value !== undefined,
	);
	if (!hasValidUpdate) {
		throw new ValidationError("At least one field must be provided for update");
	}

	// Validate individual fields if provided
	if (input.email !== undefined) {
		if (!isNonEmptyString(input.email)) {
			throw new ValidationError("Email cannot be empty", "email");
		}
		if (!isValidEmail(input.email)) {
			throw new ValidationError("Email must be a valid email address", "email");
		}
	}

	if (input.name !== undefined && !isNonEmptyString(input.name)) {
		throw new ValidationError("Name cannot be empty", "name");
	}

	if (
		input.notionAccessToken !== undefined &&
		!isNonEmptyString(input.notionAccessToken)
	) {
		throw new ValidationError(
			"Notion access token cannot be empty",
			"notionAccessToken",
		);
	}

	if (
		input.avatarUrl !== undefined &&
		input.avatarUrl !== null &&
		!isNonEmptyString(input.avatarUrl)
	) {
		throw new ValidationError(
			"Avatar URL cannot be empty if provided",
			"avatarUrl",
		);
	}
}

/**
 * Validates user ID format
 */
export function validateUserId(userId: string): void {
	if (!userId || !isNonEmptyString(userId)) {
		throw new ValidationError(
			"User ID is required and cannot be empty",
			"userId",
		);
	}
}

/**
 * Validates task ID format
 */
export function validateTaskId(taskId: string): void {
	if (!taskId || !isNonEmptyString(taskId)) {
		throw new ValidationError(
			"Task ID is required and cannot be empty",
			"taskId",
		);
	}
}

/**
 * Validates workspace ID format
 */
export function validateWorkspaceId(workspaceId: string): void {
	if (!workspaceId || !isNonEmptyString(workspaceId)) {
		throw new ValidationError(
			"Workspace ID is required and cannot be empty",
			"workspaceId",
		);
	}
}

/**
 * Validates task creation input
 */
export function validateCreateTaskInput(input: CreateTaskInput): void {
	if (!input.workspaceId || !isNonEmptyString(input.workspaceId)) {
		throw new ValidationError(
			"Workspace ID is required and cannot be empty",
			"workspaceId",
		);
	}

	if (!input.title || !isNonEmptyString(input.title)) {
		throw new ValidationError("Title is required and cannot be empty", "title");
	}

	// Validate optional fields if provided
	if (input.status !== undefined) {
		const validStatuses = ["todo", "in-progress", "done", "archived"];
		if (!validStatuses.includes(input.status)) {
			throw new ValidationError(
				`Status must be one of: ${validStatuses.join(", ")}`,
				"status",
			);
		}
	}

	if (input.priority !== undefined) {
		const validPriorities = ["low", "medium", "high", "urgent"];
		if (!validPriorities.includes(input.priority)) {
			throw new ValidationError(
				`Priority must be one of: ${validPriorities.join(", ")}`,
				"priority",
			);
		}
	}

	if (input.dueDate !== undefined && input.dueDate !== null) {
		if (!isNonEmptyString(input.dueDate)) {
			throw new ValidationError(
				"Due date cannot be empty if provided",
				"dueDate",
			);
		}
		// Validate ISO date format
		const date = new Date(input.dueDate);
		if (Number.isNaN(date.getTime())) {
			throw new ValidationError(
				"Due date must be a valid ISO date string",
				"dueDate",
			);
		}
	}
}

/**
 * Validates task update input
 */
export function validateUpdateTaskInput(input: UpdateTaskInput): void {
	// Check that at least one field is provided for update
	const hasValidUpdate = Object.values(input).some(
		(value) => value !== undefined,
	);
	if (!hasValidUpdate) {
		throw new ValidationError("At least one field must be provided for update");
	}

	// Validate individual fields if provided
	if (input.title !== undefined && !isNonEmptyString(input.title)) {
		throw new ValidationError("Title cannot be empty", "title");
	}

	if (input.status !== undefined) {
		const validStatuses = ["todo", "in-progress", "done", "archived"];
		if (!validStatuses.includes(input.status)) {
			throw new ValidationError(
				`Status must be one of: ${validStatuses.join(", ")}`,
				"status",
			);
		}
	}

	if (input.priority !== undefined) {
		const validPriorities = ["low", "medium", "high", "urgent"];
		if (!validPriorities.includes(input.priority)) {
			throw new ValidationError(
				`Priority must be one of: ${validPriorities.join(", ")}`,
				"priority",
			);
		}
	}

	if (input.dueDate !== undefined && input.dueDate !== null) {
		if (!isNonEmptyString(input.dueDate)) {
			throw new ValidationError(
				"Due date cannot be empty if provided",
				"dueDate",
			);
		}
		// Validate ISO date format
		const date = new Date(input.dueDate);
		if (Number.isNaN(date.getTime())) {
			throw new ValidationError(
				"Due date must be a valid ISO date string",
				"dueDate",
			);
		}
	}
}

/**
 * Validates workspace creation input
 */
export function validateCreateWorkspaceInput(
	input: CreateWorkspaceInput,
): void {
	if (!input.name || !isNonEmptyString(input.name)) {
		throw new ValidationError("Name is required and cannot be empty", "name");
	}

	// Validate optional description if provided
	if (
		input.description !== undefined &&
		input.description !== null &&
		!isNonEmptyString(input.description)
	) {
		throw new ValidationError(
			"Description cannot be empty if provided",
			"description",
		);
	}
}

/**
 * Validates workspace update input
 */
export function validateUpdateWorkspaceInput(
	input: UpdateWorkspaceInput,
): void {
	// Check that at least one field is provided for update
	const hasValidUpdate = Object.values(input).some(
		(value) => value !== undefined,
	);
	if (!hasValidUpdate) {
		throw new ValidationError("At least one field must be provided for update");
	}

	// Validate individual fields if provided
	if (input.name !== undefined && !isNonEmptyString(input.name)) {
		throw new ValidationError("Name cannot be empty", "name");
	}

	if (
		input.description !== undefined &&
		input.description !== null &&
		!isNonEmptyString(input.description)
	) {
		throw new ValidationError(
			"Description cannot be empty if provided",
			"description",
		);
	}
}

/**
 * Validates integration ID format
 */
export function validateIntegrationId(integrationId: string): void {
	if (!integrationId || !isNonEmptyString(integrationId)) {
		throw new ValidationError(
			"Integration ID is required and cannot be empty",
			"integrationId",
		);
	}
}

/**
 * Validates integration creation input
 */
export function validateCreateIntegrationInput(
	input: CreateIntegrationInput,
): void {
	if (!input.provider || !isNonEmptyString(input.provider)) {
		throw new ValidationError(
			"Provider is required and cannot be empty",
			"provider",
		);
	}

	if (!input.externalId || !isNonEmptyString(input.externalId)) {
		throw new ValidationError(
			"External ID is required and cannot be empty",
			"externalId",
		);
	}

	if (!input.config || typeof input.config !== "object") {
		throw new ValidationError(
			"Config is required and must be an object",
			"config",
		);
	}

	// syncEnabled is optional and defaults to true
	if (
		input.syncEnabled !== undefined &&
		typeof input.syncEnabled !== "boolean"
	) {
		throw new ValidationError("Sync enabled must be a boolean", "syncEnabled");
	}
}

/**
 * Validates integration update input
 */
export function validateUpdateIntegrationInput(
	input: UpdateIntegrationInput,
): void {
	// Check that at least one field is provided for update
	const hasValidUpdate = Object.values(input).some(
		(value) => value !== undefined,
	);
	if (!hasValidUpdate) {
		throw new ValidationError("At least one field must be provided for update");
	}

	// Validate individual fields if provided
	if (input.config !== undefined) {
		if (!input.config || typeof input.config !== "object") {
			throw new ValidationError("Config must be an object", "config");
		}
	}

	if (
		input.syncEnabled !== undefined &&
		typeof input.syncEnabled !== "boolean"
	) {
		throw new ValidationError("Sync enabled must be a boolean", "syncEnabled");
	}
}

/**
 * Validates sync metadata creation input
 */
export function validateCreateSyncMetadataInput(
	input: CreateSyncMetadataInput,
): void {
	if (!input.taskId || !isNonEmptyString(input.taskId)) {
		throw new ValidationError(
			"Task ID is required and cannot be empty",
			"taskId",
		);
	}

	if (!input.integrationId || !isNonEmptyString(input.integrationId)) {
		throw new ValidationError(
			"Integration ID is required and cannot be empty",
			"integrationId",
		);
	}

	if (!input.externalId || !isNonEmptyString(input.externalId)) {
		throw new ValidationError(
			"External ID is required and cannot be empty",
			"externalId",
		);
	}

	// Validate optional fields if provided
	if (input.syncStatus !== undefined) {
		const validStatuses = ["pending", "synced", "conflict", "error"];
		if (!validStatuses.includes(input.syncStatus)) {
			throw new ValidationError(
				`Sync status must be one of: ${validStatuses.join(", ")}`,
				"syncStatus",
			);
		}
	}

	if (
		input.lastExternalUpdate !== undefined &&
		input.lastExternalUpdate !== null
	) {
		if (!isNonEmptyString(input.lastExternalUpdate)) {
			throw new ValidationError(
				"Last external update cannot be empty if provided",
				"lastExternalUpdate",
			);
		}
		// Validate ISO date format
		const date = new Date(input.lastExternalUpdate);
		if (Number.isNaN(date.getTime())) {
			throw new ValidationError(
				"Last external update must be a valid ISO date string",
				"lastExternalUpdate",
			);
		}
	}
}

/**
 * Validates sync metadata update input
 */
export function validateUpdateSyncMetadataInput(
	input: UpdateSyncMetadataInput,
): void {
	// Check that at least one field is provided for update
	const hasValidUpdate = Object.values(input).some(
		(value) => value !== undefined,
	);
	if (!hasValidUpdate) {
		throw new ValidationError("At least one field must be provided for update");
	}

	// Validate individual fields if provided
	if (input.externalId !== undefined && !isNonEmptyString(input.externalId)) {
		throw new ValidationError("External ID cannot be empty", "externalId");
	}

	if (input.syncStatus !== undefined) {
		const validStatuses = ["pending", "synced", "conflict", "error"];
		if (!validStatuses.includes(input.syncStatus)) {
			throw new ValidationError(
				`Sync status must be one of: ${validStatuses.join(", ")}`,
				"syncStatus",
			);
		}
	}

	if (input.lastSyncAt !== undefined && input.lastSyncAt !== null) {
		if (!isNonEmptyString(input.lastSyncAt)) {
			throw new ValidationError(
				"Last sync at cannot be empty if provided",
				"lastSyncAt",
			);
		}
		// Validate ISO date format
		const date = new Date(input.lastSyncAt);
		if (Number.isNaN(date.getTime())) {
			throw new ValidationError(
				"Last sync at must be a valid ISO date string",
				"lastSyncAt",
			);
		}
	}

	if (
		input.lastExternalUpdate !== undefined &&
		input.lastExternalUpdate !== null
	) {
		if (!isNonEmptyString(input.lastExternalUpdate)) {
			throw new ValidationError(
				"Last external update cannot be empty if provided",
				"lastExternalUpdate",
			);
		}
		// Validate ISO date format
		const date = new Date(input.lastExternalUpdate);
		if (Number.isNaN(date.getTime())) {
			throw new ValidationError(
				"Last external update must be a valid ISO date string",
				"lastExternalUpdate",
			);
		}
	}

	if (input.retryCount !== undefined) {
		if (typeof input.retryCount !== "number" || input.retryCount < 0) {
			throw new ValidationError(
				"Retry count must be a non-negative number",
				"retryCount",
			);
		}
	}

	if (
		input.lastError !== undefined &&
		input.lastError !== null &&
		!isNonEmptyString(input.lastError)
	) {
		throw new ValidationError(
			"Last error cannot be empty if provided",
			"lastError",
		);
	}
}
