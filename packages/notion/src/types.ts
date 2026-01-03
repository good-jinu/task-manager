import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export interface NotionDatabase {
	id: string;
	title: string;
	description?: string;
	url: string;
	createdTime: Date;
	lastEditedTime: Date;
}

export type NotionPage = {
	id: string;
	title: string;
	url: string;
	createdTime: Date;
	lastEditedTime: Date;
	archived: boolean;
} & Pick<PageObjectResponse, "properties">;

export interface DatabaseConfig {
	userId: string;
	databaseId: string;
	title: string;
	description?: string;
	selectedAt: Date;
}

/**
 * Properties for creating or updating a Notion page
 */
export interface PageProperties {
	title: string;
	content?: string;
}
