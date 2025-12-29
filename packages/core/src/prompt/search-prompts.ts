// Prompt manager for loading and formatting templates
// Serverless-compatible implementation with embedded templates

import { PromptType } from "./types.js";

export interface PromptManager {
	getSearchPrompt(type: PromptType): Promise<string>;
	formatPrompt(template: string, variables: Record<string, unknown>): string;
	validatePrompt(prompt: string): boolean;
}

// Embedded templates for serverless deployment
const EMBEDDED_TEMPLATES: Record<PromptType, string> = {
	[PromptType.SEMANTIC_SEARCH]: `You are an intelligent task search assistant. Your job is to analyze user queries and find the most relevant tasks from a database.

Given the following user query:
Query: {{query}}

Please analyze the semantic meaning and extract key concepts that would help identify relevant tasks. Consider:
- Main action or verb (e.g., "create", "update", "fix", "implement")
- Subject matter or domain (e.g., "authentication", "database", "UI")
- Context or constraints mentioned
- Technical terms or technologies referenced

Return your analysis in a structured format that can be used for database searching.`,

	[PromptType.DATE_ANALYSIS]: `You are a date interpretation specialist. Your job is to parse relative date expressions and convert them to specific dates.

Given the following date expression:
Date Input: {{dateInput}}
Current Date: {{currentDate}}

Please interpret this relative date and provide:
1. The target date in ISO format
2. Your confidence level (0-1)
3. A brief explanation of your interpretation

Consider common patterns like:
- "last week", "this week", "next week"
- "2 days ago", "3 weeks ago"
- "yesterday", "today", "tomorrow"
- "last month", "this month"
- Specific dates like "January 15" or "2024-01-15"

If the date expression is ambiguous or invalid, explain why and suggest alternatives.`,

	[PromptType.RESULT_RANKING]: `You are a result ranking specialist. Your job is to rank search results based on relevance and date proximity.

Given the following search context:
Original Query: {{query}}
Target Date: {{targetDate}}
Date Weight Factor: {{dateWeight}}

For each result, consider:
1. Semantic relevance to the query (0-1 score)
2. Date proximity to target date (0-1 score, where 1 is exact match)
3. Combined score calculation

Results to rank:
{{results}}

Please provide a ranked list with scores and brief explanations for the ranking decisions.`,
};

export class PromptManagerImpl implements PromptManager {
	private templateCache = new Map<PromptType, string>();

	async getSearchPrompt(type: PromptType): Promise<string> {
		// Check cache first
		if (this.templateCache.has(type)) {
			const cached = this.templateCache.get(type);
			if (cached) {
				return cached;
			}
		}

		// Get template from embedded templates
		const template = EMBEDDED_TEMPLATES[type];
		if (!template) {
			throw new Error(`Unknown prompt template type: ${type}`);
		}

		// Cache the template for future use
		this.templateCache.set(type, template);

		return template;
	}

	formatPrompt(template: string, variables: Record<string, unknown>): string {
		if (!this.validatePrompt(template)) {
			throw new Error("Invalid prompt template provided");
		}

		let formattedPrompt = template;

		// Replace all variables in the format {{variableName}}
		for (const [key, value] of Object.entries(variables)) {
			const placeholder = `{{${key}}}`;
			const stringValue = String(value);
			formattedPrompt = formattedPrompt.replace(
				new RegExp(placeholder, "g"),
				stringValue,
			);
		}

		// Check for any remaining unreplaced variables
		const unreplacedVariables = formattedPrompt.match(/\{\{[^}]+\}\}/g);
		if (unreplacedVariables) {
			throw new Error(
				`Missing variables in prompt: ${unreplacedVariables.join(", ")}`,
			);
		}

		return formattedPrompt;
	}

	validatePrompt(prompt: string): boolean {
		// Basic validation - check if prompt is not empty and is a string
		if (typeof prompt !== "string" || prompt.trim().length === 0) {
			return false;
		}

		// Check for balanced braces in variable placeholders
		const openBraces = (prompt.match(/\{\{/g) || []).length;
		const closeBraces = (prompt.match(/\}\}/g) || []).length;

		return openBraces === closeBraces;
	}

	// Method to clear cache if needed (useful for testing)
	clearCache(): void {
		this.templateCache.clear();
	}

	// Method to preload all templates (useful for initialization in serverless)
	async preloadTemplates(): Promise<void> {
		const promptTypes = Object.values(PromptType);
		await Promise.all(promptTypes.map((type) => this.getSearchPrompt(type)));
	}
}
