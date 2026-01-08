/**
 * Utility functions for input validation and sanitization
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
 * Validates and sanitizes a string input
 */
export function validateString(
	value: unknown,
	fieldName: string,
	options: {
		required?: boolean;
		minLength?: number;
		maxLength?: number;
		trim?: boolean;
	} = {},
): string {
	const {
		required = true,
		minLength = 0,
		maxLength = Infinity,
		trim = true,
	} = options;

	if (value === null || value === undefined) {
		if (required) {
			throw new ValidationError(`${fieldName} is required`, fieldName);
		}
		return "";
	}

	if (typeof value !== "string") {
		throw new ValidationError(`${fieldName} must be a string`, fieldName);
	}

	let sanitized = trim ? value.trim() : value;

	if (required && sanitized.length === 0) {
		throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
	}

	if (sanitized.length < minLength) {
		throw new ValidationError(
			`${fieldName} must be at least ${minLength} characters`,
			fieldName,
		);
	}

	if (sanitized.length > maxLength) {
		throw new ValidationError(
			`${fieldName} cannot exceed ${maxLength} characters`,
			fieldName,
		);
	}

	return sanitized;
}

/**
 * Validates workspace ID format
 */
export function validateWorkspaceId(workspaceId: unknown): string {
	const validated = validateString(workspaceId, "Workspace ID", {
		required: true,
		minLength: 1,
		maxLength: 100,
	});

	// Additional workspace ID format validation if needed
	if (!/^[a-zA-Z0-9_-]+$/.test(validated)) {
		throw new ValidationError(
			"Workspace ID can only contain letters, numbers, hyphens, and underscores",
			"workspaceId",
		);
	}

	return validated;
}

/**
 * Validates user ID (handles both authenticated and guest users)
 */
export function validateUserId(userId: unknown): string {
	const validated = validateString(userId, "User ID", {
		required: true,
		minLength: 1,
		maxLength: 100,
	});

	return validated;
}

/**
 * Sanitizes message content for AI processing
 */
export function sanitizeMessage(message: unknown): string {
	const validated = validateString(message, "Message", {
		required: true,
		minLength: 1,
		maxLength: 1000,
	});

	// Remove potentially harmful content
	return validated
		.replace(/[<>]/g, "") // Remove angle brackets
		.replace(/javascript:/gi, "") // Remove javascript: protocol
		.replace(/data:/gi, ""); // Remove data: protocol
}

/**
 * Rate limiting helper for guest users
 */
export function isGuestUser(userId: string): boolean {
	return userId.startsWith("guest-") || !userId.includes("@");
}

/**
 * Validates request body structure
 */
export function validateChatRequest(body: unknown): {
	message: string;
	workspaceId: string;
	userId: string;
} {
	if (!body || typeof body !== "object") {
		throw new ValidationError("Request body must be an object");
	}

	const request = body as Record<string, unknown>;

	return {
		message: sanitizeMessage(request.message),
		workspaceId: validateWorkspaceId(request.workspaceId),
		userId: validateUserId(request.userId),
	};
}
