// Environment configuration for OpenAI integration

import { ConfigurationError } from "./validation.js";

export interface OpenAIConfig {
	apiKey: string;
	baseUrl?: string;
	model: string;
	maxTokens: number;
	temperature: number;
}

export interface SearchConfig {
	maxResults: number;
	relevanceThreshold: number;
	dateWeightFactor: number;
	cacheEnabled: boolean;
	cacheTtl: number;
}

/**
 * Environment configuration manager for the intelligent task finder
 * Handles OpenAI API configuration and validation
 */
export class EnvironmentConfig {
	private static _openaiConfig: OpenAIConfig | null = null;
	private static _searchConfig: SearchConfig | null = null;

	/**
	 * Gets OpenAI configuration from environment variables
	 * Validates required OPENAI_API_KEY and optional OPENAI_BASE_URL
	 */
	static getOpenAIConfig(): OpenAIConfig {
		if (EnvironmentConfig._openaiConfig) {
			return EnvironmentConfig._openaiConfig;
		}

		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new ConfigurationError(
				"OPENAI_API_KEY environment variable is required but not set. " +
					"Please set your OpenAI API key in the environment variables.",
			);
		}

		const baseUrl = process.env.OPENAI_BASE_URL;

		EnvironmentConfig._openaiConfig = {
			apiKey,
			baseUrl,
			model: process.env.OPENAI_MODEL || "gpt-4",
			maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || "2000", 10),
			temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0.7"),
		};

		return EnvironmentConfig._openaiConfig;
	}

	/**
	 * Gets search configuration with default values
	 */
	static getSearchConfig(): SearchConfig {
		if (EnvironmentConfig._searchConfig) {
			return EnvironmentConfig._searchConfig;
		}

		EnvironmentConfig._searchConfig = {
			maxResults: parseInt(process.env.SEARCH_MAX_RESULTS || "10", 10),
			relevanceThreshold: parseFloat(
				process.env.SEARCH_RELEVANCE_THRESHOLD || "0.5",
			),
			dateWeightFactor: parseFloat(
				process.env.SEARCH_DATE_WEIGHT_FACTOR || "0.3",
			),
			cacheEnabled: process.env.SEARCH_CACHE_ENABLED !== "false",
			cacheTtl: parseInt(process.env.SEARCH_CACHE_TTL || "300", 10), // 5 minutes default
		};

		return EnvironmentConfig._searchConfig;
	}

	/**
	 * Validates all required environment configuration on startup
	 * Throws ConfigurationError if validation fails
	 */
	static validateConfig(): boolean {
		try {
			// Validate OpenAI configuration
			const openaiConfig = EnvironmentConfig.getOpenAIConfig();

			if (!openaiConfig.apiKey.trim()) {
				throw new ConfigurationError("OPENAI_API_KEY cannot be empty");
			}

			// Validate baseUrl format if provided
			if (openaiConfig.baseUrl) {
				try {
					new URL(openaiConfig.baseUrl);
				} catch {
					throw new ConfigurationError(
						`OPENAI_BASE_URL "${openaiConfig.baseUrl}" is not a valid URL`,
					);
				}
			}

			// Validate numeric configurations
			if (openaiConfig.maxTokens <= 0) {
				throw new ConfigurationError(
					"OPENAI_MAX_TOKENS must be a positive number",
				);
			}

			if (openaiConfig.temperature < 0 || openaiConfig.temperature > 2) {
				throw new ConfigurationError(
					"OPENAI_TEMPERATURE must be between 0 and 2",
				);
			}

			// Validate search configuration
			const searchConfig = EnvironmentConfig.getSearchConfig();

			if (searchConfig.maxResults <= 0) {
				throw new ConfigurationError(
					"SEARCH_MAX_RESULTS must be a positive number",
				);
			}

			if (
				searchConfig.relevanceThreshold < 0 ||
				searchConfig.relevanceThreshold > 1
			) {
				throw new ConfigurationError(
					"SEARCH_RELEVANCE_THRESHOLD must be between 0 and 1",
				);
			}

			if (
				searchConfig.dateWeightFactor < 0 ||
				searchConfig.dateWeightFactor > 1
			) {
				throw new ConfigurationError(
					"SEARCH_DATE_WEIGHT_FACTOR must be between 0 and 1",
				);
			}

			if (searchConfig.cacheTtl < 0) {
				throw new ConfigurationError("SEARCH_CACHE_TTL must be non-negative");
			}

			return true;
		} catch (error) {
			if (error instanceof ConfigurationError) {
				throw error;
			}
			throw new ConfigurationError(
				`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Resets cached configuration (useful for testing)
	 */
	static resetCache(): void {
		EnvironmentConfig._openaiConfig = null;
		EnvironmentConfig._searchConfig = null;
	}

	/**
	 * Gets all required environment variables for documentation
	 */
	static getRequiredEnvironmentVariables(): string[] {
		return ["OPENAI_API_KEY"];
	}

	/**
	 * Gets all optional environment variables for documentation
	 */
	static getOptionalEnvironmentVariables(): string[] {
		return [
			"OPENAI_BASE_URL",
			"OPENAI_MODEL",
			"OPENAI_MAX_TOKENS",
			"OPENAI_TEMPERATURE",
			"SEARCH_MAX_RESULTS",
			"SEARCH_RELEVANCE_THRESHOLD",
			"SEARCH_DATE_WEIGHT_FACTOR",
			"SEARCH_CACHE_ENABLED",
			"SEARCH_CACHE_TTL",
		];
	}
}
