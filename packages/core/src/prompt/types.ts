// Prompt management type definitions

export enum PromptType {
	SEMANTIC_SEARCH = "semantic-search",
	DATE_ANALYSIS = "date-analysis",
	RESULT_RANKING = "result-ranking",
}

export interface PromptTemplate {
	type: PromptType;
	content: string;
	variables: string[];
}
