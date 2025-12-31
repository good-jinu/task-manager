// Configuration validation utilities for the web application

/**
 * Checks if OpenAI configuration is available
 * @returns true if OPENAI_API_KEY is set, false otherwise
 */
export function isOpenAIConfigured(): boolean {
	return !!process.env.OPENAI_API_KEY;
}

/**
 * Gets OpenAI configuration status for debugging
 */
export function getOpenAIConfigStatus(): {
	configured: boolean;
	error?: string;
} {
	const configured = isOpenAIConfigured();
	return {
		configured,
		error: configured
			? undefined
			: "OPENAI_API_KEY environment variable is not set",
	};
}
