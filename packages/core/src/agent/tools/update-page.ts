import { z } from "zod";
import type { ToolCommonArgs } from "./common";

export const updatePageInputSchema = z.object({
	pageId: z.string().describe("The ID of the page to update"),
	title: z.string().optional().describe("New title for the page (optional)"),
	content: z
		.string()
		.optional()
		.describe(
			"New content for the page in markdown format (optional, replaces existing content)",
		),
});

export type UpdatePageInput = z.infer<typeof updatePageInputSchema>;

export interface UpdatePageOutput {
	pageId: string;
	pageUrl: string;
	pageTitle: string;
}

export async function executeUpdatePage(
	params: ToolCommonArgs & {
		input: UpdatePageInput;
	},
): Promise<UpdatePageOutput> {
	const { input, notionManager } = params;
	if (!notionManager) {
		throw new Error("Notion manager is not initialized");
	}

	try {
		const page = await notionManager.updatePageWithMarkdown(
			input.pageId,
			input.title,
			input.content,
		);

		const result = {
			pageId: page.id,
			pageUrl: page.url,
			pageTitle: page.title,
		};

		return result;
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		// Re-throw with enhanced error message for the agent to handle
		throw new Error(`Failed to update page: ${errorMessage}`);
	}
}
