import { z } from "zod";
import type { ToolCommonArgs } from "./common";

export const updatePageInputSchema = z.object({
	pageId: z.string().describe("The ID of the page to update"),
	content: z
		.string()
		.describe("New content for the page (replaces existing content)"),
});

export type UpdatePageInput = z.infer<typeof updatePageInputSchema>;

export interface UpdatePageOutput {
	pageId: string;
	pageUrl: string;
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
		const page = await notionManager.updatePageContent(
			input.pageId,
			input.content,
		);

		const result = {
			pageId: page.id,
			pageUrl: page.url,
		};

		return result;
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		// Re-throw with enhanced error message for the agent to handle
		throw new Error(`Failed to update page content: ${errorMessage}`);
	}
}
