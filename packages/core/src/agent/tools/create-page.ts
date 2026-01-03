import { z } from "zod";
import type { ToolCommonArgs } from "./common";

export const createPageInputSchema = z.object({
	title: z.string().describe("The title for the new page"),
	content: z
		.string()
		.optional()
		.describe("The content for the page as plain text"),
});

export type CreatePageInput = z.infer<typeof createPageInputSchema>;

export interface CreatePageOutput {
	pageId: string;
	pageUrl: string;
	pageTitle: string;
}

export async function executeCreatePage(
	params: ToolCommonArgs & {
		input: CreatePageInput;
	},
): Promise<CreatePageOutput> {
	const { input, notionManager, databaseId } = params;
	if (!databaseId) {
		throw new Error("Database ID is not set");
	}

	if (!notionManager) {
		throw new Error("Notion manager is not set");
	}

	try {
		const page = await notionManager.createPage(databaseId, {
			title: input.title,
			content: input.content,
		});

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
		throw new Error(`Failed to create page: ${errorMessage}`);
	}
}
