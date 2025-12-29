// Prompt manager for loading and formatting templates

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PromptType } from "./types.js";

export interface PromptManager {
	getSearchPrompt(type: PromptType): Promise<string>;
	formatPrompt(template: string, variables: Record<string, unknown>): string;
	validatePrompt(prompt: string): boolean;
}

export class PromptManagerImpl implements PromptManager {
	private templateCache = new Map<PromptType, string>();
	private readonly templatesDir: string;

	constructor() {
		// Get the directory of this module file
		const currentDir = dirname(fileURLToPath(import.meta.url));
		this.templatesDir = join(currentDir, "templates");
	}

	async getSearchPrompt(type: PromptType): Promise<string> {
		// Check cache first
		if (this.templateCache.has(type)) {
			const cached = this.templateCache.get(type);
			if (cached) {
				return cached;
			}
		}

		try {
			const templatePath = join(this.templatesDir, `${type}.txt`);
			const content = await readFile(templatePath, "utf-8");

			// Cache the template for future use
			this.templateCache.set(type, content);

			return content;
		} catch (error) {
			throw new Error(
				`Failed to load prompt template '${type}': ${error instanceof Error ? error.message : String(error)}`,
			);
		}
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

	// Method to clear cache if needed (useful for testing or dynamic reloading)
	clearCache(): void {
		this.templateCache.clear();
	}

	// Method to preload all templates (useful for initialization)
	async preloadTemplates(): Promise<void> {
		const promptTypes = Object.values(PromptType);
		await Promise.all(promptTypes.map((type) => this.getSearchPrompt(type)));
	}
}
