export interface ExecutionStep {
	stepId: string;
	toolName: string;
	input: Record<string, unknown>;
	output?: Record<string, unknown>;
	error?: string;
	timestamp: string;
}

export interface AgentExecutionResult {
	action: "created" | "updated" | "none";
	pageId?: string;
	pageTitle?: string;
	pageUrl?: string;
	reasoning: string;
}

export interface AgentExecutionRecord {
	userId: string;
	executionId: string;
	status: "pending" | "done" | "fail";
	query: string;
	databaseId: string;
	steps: ExecutionStep[];
	result?: AgentExecutionResult;
	error?: string;
	createdAt: string;
	updatedAt: string;
}

export interface Database {
	id: string;
	title: string;
}
