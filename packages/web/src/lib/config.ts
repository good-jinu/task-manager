// Configuration validation utilities for the web application

import { EnvironmentConfig } from "@notion-task-manager/core";

/**
 * Checks if OpenAI configuration is available without throwing
 * Useful for conditional feature enablement
 * @returns true if OpenAI is properly configured, false otherwise
 */
export function isOpenAIConfigured(): boolean {
	try {
		EnvironmentConfig.validateConfig();
		return true;
	} catch {
		return false;
	}
}

/**
 * Gets OpenAI configuration status for debugging
 * @returns object with configuration status and any error messages
 */
export function getOpenAIConfigStatus(): {
	configured: boolean;
	error?: string;
	requiredVars: string[];
	optionalVars: string[];
} {
	try {
		EnvironmentConfig.validateConfig();
		return {
			configured: true,
			requiredVars: EnvironmentConfig.getRequiredEnvironmentVariables(),
			optionalVars: EnvironmentConfig.getOptionalEnvironmentVariables(),
		};
	} catch (error) {
		return {
			configured: false,
			error: error instanceof Error ? error.message : "Unknown error",
			requiredVars: EnvironmentConfig.getRequiredEnvironmentVariables(),
			optionalVars: EnvironmentConfig.getOptionalEnvironmentVariables(),
		};
	}
}
