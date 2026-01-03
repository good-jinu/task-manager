import { z } from "zod";
import type { ToolCommonArgs } from "./common";

export const searchPagesInputSchema = z.object({
	query: z
		.array(z.string())
		.describe(
			"Array of search terms to find similar pages. Use multiple keywords for better matching.",
		),
	maxResults: z
		.number()
		.optional()
		.default(10)
		.describe("Maximum number of results to return"),
});

export type SearchPagesInput = z.infer<typeof searchPagesInputSchema>;

export interface SearchPagesOutput {
	pages: Array<{
		id: string;
		title: string;
		url: string;
		content: string;
		properties: Record<string, unknown>;
	}>;
}

export async function executeSearchPages(
	params: ToolCommonArgs & {
		input: SearchPagesInput;
	},
): Promise<SearchPagesOutput> {
	const { input, notionManager, databaseId } = params;
	if (!databaseId) {
		throw new Error("No database ID provided");
	}
	if (!notionManager) {
		throw new Error("No notion manager provided");
	}

	try {
		// Search with each query term and combine results
		const allPages = new Map();

		for (const searchTerm of input.query) {
			const pages = await notionManager.queryDatabasePages(
				databaseId,
				searchTerm,
			);

			// Add pages to map to avoid duplicates
			for (const page of pages) {
				allPages.set(page.id, page);
			}
		}

		const uniquePages = Array.from(allPages.values());
		const limitedPages = uniquePages.slice(0, input.maxResults || 10);

		// Fetch content for each page
		const pagesWithContent = await Promise.all(
			limitedPages.map(async (page) => {
				try {
					const content = await notionManager.getPageContent(page.id);
					return {
						id: page.id,
						title: page.title,
						url: page.url,
						content: content,
						properties: page.properties as Record<string, unknown>,
					};
				} catch (_error) {
					// If content fetch fails, return page without content
					return {
						id: page.id,
						title: page.title,
						url: page.url,
						content: "",
						properties: page.properties as Record<string, unknown>,
					};
				}
			}),
		);

		const result = {
			pages: pagesWithContent,
		};

		return result;
	} catch (_error) {
		// Return empty result on error to allow agent to continue
		return { pages: [] };
	}
}
