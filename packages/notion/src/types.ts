export interface NotionDatabase {
	id: string;
	title: string;
	description?: string;
	url: string;
	createdTime: Date;
	lastEditedTime: Date;
}

export interface NotionPage {
	id: string;
	title: string;
	properties: Record<string, any>;
	url: string;
	createdTime: Date;
	lastEditedTime: Date;
}

export interface DatabaseConfig {
	userId: string;
	databaseId: string;
	title: string;
	description?: string;
	selectedAt: Date;
}
