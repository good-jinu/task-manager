// Configuration validation utilities

export class ConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigurationError";
	}
}

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ValidationError";
	}
}

/**
 * Configuration validator for environment variables and settings
 */
export class ConfigValidator {
	/**
	 * Validates that required environment variables are present
	 * @param requiredVars Array of required environment variable names
	 * @throws ConfigurationError if any required variables are missing
	 */
	static validateEnvironmentVariables(requiredVars: string[]): void {
		const missingVars: string[] = [];

		for (const varName of requiredVars) {
			if (!process.env[varName]) {
				missingVars.push(varName);
			}
		}

		if (missingVars.length > 0) {
			throw new ConfigurationError(
				`Missing required environment variables: ${missingVars.join(", ")}. ` +
					"Please set these variables before starting the application.",
			);
		}
	}

	/**
	 * Validates OpenAI configuration object
	 * @param config OpenAI configuration to validate
	 * @returns true if valid
	 * @throws ValidationError if configuration is invalid
	 */
	static validateOpenAIConfig(config: any): boolean {
		if (!config) {
			throw new ValidationError("OpenAI configuration is required");
		}

		if (typeof config.apiKey !== "string" || !config.apiKey.trim()) {
			throw new ValidationError("OpenAI API key must be a non-empty string");
		}

		if (config.baseUrl && typeof config.baseUrl !== "string") {
			throw new ValidationError("OpenAI base URL must be a string");
		}

		if (config.baseUrl) {
			try {
				new URL(config.baseUrl);
			} catch {
				throw new ValidationError(`Invalid OpenAI base URL: ${config.baseUrl}`);
			}
		}

		if (typeof config.model !== "string" || !config.model.trim()) {
			throw new ValidationError("OpenAI model must be a non-empty string");
		}

		if (typeof config.maxTokens !== "number" || config.maxTokens <= 0) {
			throw new ValidationError("OpenAI maxTokens must be a positive number");
		}

		if (
			typeof config.temperature !== "number" ||
			config.temperature < 0 ||
			config.temperature > 2
		) {
			throw new ValidationError(
				"OpenAI temperature must be a number between 0 and 2",
			);
		}

		return true;
	}

	/**
	 * Validates search configuration object
	 * @param config Search configuration to validate
	 * @returns true if valid
	 * @throws ValidationError if configuration is invalid
	 */
	static validateSearchConfig(config: any): boolean {
		if (!config) {
			throw new ValidationError("Search configuration is required");
		}

		if (typeof config.maxResults !== "number" || config.maxResults <= 0) {
			throw new ValidationError("Search maxResults must be a positive number");
		}

		if (
			typeof config.relevanceThreshold !== "number" ||
			config.relevanceThreshold < 0 ||
			config.relevanceThreshold > 1
		) {
			throw new ValidationError(
				"Search relevanceThreshold must be a number between 0 and 1",
			);
		}

		if (
			typeof config.dateWeightFactor !== "number" ||
			config.dateWeightFactor < 0 ||
			config.dateWeightFactor > 1
		) {
			throw new ValidationError(
				"Search dateWeightFactor must be a number between 0 and 1",
			);
		}

		if (typeof config.cacheEnabled !== "boolean") {
			throw new ValidationError("Search cacheEnabled must be a boolean");
		}

		if (typeof config.cacheTtl !== "number" || config.cacheTtl < 0) {
			throw new ValidationError(
				"Search cacheTtl must be a non-negative number",
			);
		}

		return true;
	}

	/**
	 * Validates a URL string
	 * @param url URL string to validate
	 * @param fieldName Name of the field for error messages
	 * @returns true if valid
	 * @throws ValidationError if URL is invalid
	 */
	static validateUrl(url: string, fieldName: string = "URL"): boolean {
		try {
			new URL(url);
			return true;
		} catch {
			throw new ValidationError(`${fieldName} "${url}" is not a valid URL`);
		}
	}

	/**
	 * Validates that a number is within a specified range
	 * @param value Number to validate
	 * @param min Minimum value (inclusive)
	 * @param max Maximum value (inclusive)
	 * @param fieldName Name of the field for error messages
	 * @returns true if valid
	 * @throws ValidationError if number is out of range
	 */
	static validateNumberRange(
		value: number,
		min: number,
		max: number,
		fieldName: string,
	): boolean {
		if (typeof value !== "number" || isNaN(value)) {
			throw new ValidationError(`${fieldName} must be a valid number`);
		}

		if (value < min || value > max) {
			throw new ValidationError(
				`${fieldName} must be between ${min} and ${max}, got ${value}`,
			);
		}

		return true;
	}

	/**
	 * Validates that a string is non-empty
	 * @param value String to validate
	 * @param fieldName Name of the field for error messages
	 * @returns true if valid
	 * @throws ValidationError if string is empty
	 */
	static validateNonEmptyString(value: string, fieldName: string): boolean {
		if (typeof value !== "string") {
			throw new ValidationError(`${fieldName} must be a string`);
		}

		if (!value.trim()) {
			throw new ValidationError(`${fieldName} cannot be empty`);
		}

		return true;
	}
}
