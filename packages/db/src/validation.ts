import type { CreateUserInput, UpdateUserInput } from "./types";

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
