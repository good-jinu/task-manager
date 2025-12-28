import type { EnvironmentConfig } from "./types.js";

/**
 * Validates and loads environment configuration
 * Throws clear error messages for missing required variables
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
	const requiredVars = {
		// Authentication
		AUTH_SECRET: process.env.AUTH_SECRET,
		AUTH_NOTION_ID: process.env.AUTH_NOTION_ID,
		AUTH_NOTION_SECRET: process.env.AUTH_NOTION_SECRET,
		AUTH_NOTION_REDIRECT_URI: process.env.AUTH_NOTION_REDIRECT_URI,

		// Database
		AWS_REGION: process.env.AWS_REGION,
		DYNAMODB_USERS_TABLE: process.env.DYNAMODB_USERS_TABLE,
		DYNAMODB_TASKS_TABLE: process.env.DYNAMODB_TASKS_TABLE,

		// Application
		DOMAIN_NAME: process.env.DOMAIN_NAME,
		NODE_ENV: process.env.NODE_ENV as "development" | "staging" | "production",
	};

	// Check for missing required environment variables
	const missingVars: string[] = [];

	for (const [key, value] of Object.entries(requiredVars)) {
		if (!value) {
			missingVars.push(key);
		}
	}

	if (missingVars.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missingVars.join(", ")}. ` +
				"Please check your environment configuration.",
		);
	}

	// Validate NODE_ENV
	const validNodeEnvs = ["development", "staging", "production"];
	if (!validNodeEnvs.includes(requiredVars.NODE_ENV)) {
		throw new Error(
			`Invalid NODE_ENV: ${requiredVars.NODE_ENV}. ` +
				`Must be one of: ${validNodeEnvs.join(", ")}`,
		);
	}

	return requiredVars as EnvironmentConfig;
}

/**
 * Cached environment configuration
 */
let cachedConfig: EnvironmentConfig | null = null;

/**
 * Gets the environment configuration, loading it once and caching the result
 */
export function getEnvironmentConfig(): EnvironmentConfig {
	if (!cachedConfig) {
		cachedConfig = loadEnvironmentConfig();
	}
	return cachedConfig;
}
