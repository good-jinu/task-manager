import type { Session } from "@auth/sveltekit";
import type { AgentExecutionRecord } from "@notion-task-manager/db";
import type { NotionDatabase } from "./notion";

export interface PageData {
	session: Session | null;
	databases: NotionDatabase[];
	executions: AgentExecutionRecord[];
	isAuthenticated: boolean;
}
