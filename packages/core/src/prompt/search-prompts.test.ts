import { beforeEach, describe, expect, it } from "vitest";
import { PromptManagerImpl } from "./search-prompts.js";
import { PromptType } from "./types.js";

describe("PromptManager", () => {
	let promptManager: PromptManagerImpl;

	beforeEach(() => {
		promptManager = new PromptManagerImpl();
	});

	it("should load semantic search template", async () => {
		const template = await promptManager.getSearchPrompt(
			PromptType.SEMANTIC_SEARCH,
		);
		expect(template).toContain("intelligent task search assistant");
		expect(template).toContain("{{query}}");
	});

	it("should load date analysis template", async () => {
		const template = await promptManager.getSearchPrompt(
			PromptType.DATE_ANALYSIS,
		);
		expect(template).toContain("date interpretation specialist");
		expect(template).toContain("{{dateInput}}");
		expect(template).toContain("{{currentDate}}");
	});

	it("should load result ranking template", async () => {
		const template = await promptManager.getSearchPrompt(
			PromptType.RESULT_RANKING,
		);
		expect(template).toContain("result ranking specialist");
		expect(template).toContain("{{query}}");
		expect(template).toContain("{{targetDate}}");
	});

	it("should format prompt with variables", () => {
		const template = "Hello {{name}}, your age is {{age}}";
		const variables = { name: "John", age: 30 };
		const result = promptManager.formatPrompt(template, variables);
		expect(result).toBe("Hello John, your age is 30");
	});

	it("should throw error for missing variables", () => {
		const template = "Hello {{name}}, your age is {{age}}";
		const variables = { name: "John" }; // missing age
		expect(() => promptManager.formatPrompt(template, variables)).toThrow(
			"Missing variables",
		);
	});

	it("should validate correct prompts", () => {
		expect(promptManager.validatePrompt("Valid prompt")).toBe(true);
		expect(promptManager.validatePrompt("Prompt with {{variable}}")).toBe(true);
	});

	it("should invalidate incorrect prompts", () => {
		expect(promptManager.validatePrompt("")).toBe(false);
		expect(promptManager.validatePrompt("   ")).toBe(false);
		expect(promptManager.validatePrompt("Unbalanced {{variable}")).toBe(false);
	});

	it("should cache templates", async () => {
		// Load template twice
		const template1 = await promptManager.getSearchPrompt(
			PromptType.SEMANTIC_SEARCH,
		);
		const template2 = await promptManager.getSearchPrompt(
			PromptType.SEMANTIC_SEARCH,
		);

		// Should be the same reference (cached)
		expect(template1).toBe(template2);
	});

	it("should clear cache", async () => {
		await promptManager.getSearchPrompt(PromptType.SEMANTIC_SEARCH);
		promptManager.clearCache();

		// Should be able to load again after clearing cache
		const template = await promptManager.getSearchPrompt(
			PromptType.SEMANTIC_SEARCH,
		);
		expect(template).toContain("intelligent task search assistant");
	});
});
