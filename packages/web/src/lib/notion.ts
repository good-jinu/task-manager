import { Client, NotionTaskManager } from "@notion-task-manager/notion";

export function createNotionClient(accessToken: string): Client {
	return new Client({
		auth: accessToken,
	});
}

export function createNotionTaskManager(
	accessToken: string,
): NotionTaskManager {
	const client = createNotionClient(accessToken);
	return new NotionTaskManager(client);
}
