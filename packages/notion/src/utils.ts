import type { NotionPage } from "./types";

/**
 * Extract text value from a Notion property
 */
export function extractPropertyText(property: unknown): string {
	if (!property || typeof property !== "object") return "";

	const prop = property as Record<string, unknown>;
	const type = prop.type as string;

	switch (type) {
		case "title":
			return (
				(prop.title as Array<{ plain_text?: string }>)
					?.map((t) => t.plain_text || "")
					.join(" ") || ""
			);
		case "rich_text":
			return (
				(prop.rich_text as Array<{ plain_text?: string }>)
					?.map((t) => t.plain_text || "")
					.join(" ") || ""
			);
		case "select":
			return (prop.select as { name?: string })?.name || "";
		case "multi_select":
			return (
				(prop.multi_select as Array<{ name?: string }>)
					?.map((s) => s.name || "")
					.join(", ") || ""
			);
		case "number":
			return (prop.number as number)?.toString() || "";
		case "checkbox":
			return prop.checkbox ? "checked" : "unchecked";
		case "date":
			return (prop.date as { start?: string })?.start || "";
		case "url":
			return (prop.url as string) || "";
		case "email":
			return (prop.email as string) || "";
		default:
			return "";
	}
}

/**
 * Extract all properties from a Notion page as string key-value pairs
 */
export function extractProperties(
	properties: Record<string, unknown>,
): Record<string, string> {
	const extracted: Record<string, string> = {};

	for (const [key, value] of Object.entries(properties)) {
		const text = extractPropertyText(value);
		if (text) {
			extracted[key] = text;
		}
	}

	return extracted;
}

/**
 * Format a NotionPage for AI consumption as a JSON-serializable object
 */
export function formatPageForAI(page: NotionPage): object {
	return {
		id: page.id,
		title: page.title,
		url: page.url,
		createdTime: page.createdTime.toISOString(),
		lastEditedTime: page.lastEditedTime.toISOString(),
		archived: page.archived,
		properties: extractProperties(page.properties),
	};
}

/**
 * Format multiple NotionPages for AI consumption
 */
export function formatPagesForAI(pages: NotionPage[]): object[] {
	return pages.map(formatPageForAI);
}
