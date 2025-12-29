// Prompt manager for loading and formatting templates

import type { PromptType } from "./types.js";

export interface PromptManager {
	getSearchPrompt(type: PromptType): Promise<string>;
	formatPrompt(template: string, variables: Record<string, any>): string;
	validatePrompt(prompt: string): boolean;
}

// Placeholder implementation - will be implemented in later tasks
export class PromptManagerImpl implements PromptManager {
	async getSearchPrompt(type: PromptType): Promise<string> {
		throw new Error("Prompt loading not yet implemented");
	}

	formatPrompt(template: string, variables: Record<string, any>): string {
		throw new Error("Prompt formatting not yet implemented");
	}

	validatePrompt(prompt: string): boolean {
		throw new Error("Prompt validation not yet implemented");
	}
}
