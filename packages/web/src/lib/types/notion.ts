export interface NotionDatabase {
	id: string;
	title: string;
	description?: string;
	url?: string;
	createdTime?: string;
	lastEditedTime?: string;
}

export interface NotionPage {
	id: string;
	title: string;
	properties: Record<string, NotionProperty>;
	createdTime: string;
	lastEditedTime: string;
	url?: string;
}

export interface NotionProperty {
	type: string;
	title?: Array<{ plain_text: string }>;
	rich_text?: Array<{ plain_text: string }>;
	select?: { name: string };
	date?: { start: string };
}

export interface NotionConfig {
	id: string;
	userId: string;
	databaseId: string;
	title: string;
	description?: string;
	createdAt: string;
	updatedAt: string;
	selectedAt?: string;
}
