import type { Task, TaskPriority } from "@notion-task-manager/db";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getModel } from "./llm/provider";

/**
 * Task suggestion from AI analysis
 */
export interface TaskSuggestion {
	title: string;
	content?: string;
	priority?: TaskPriority;
	estimatedDuration?: string;
	reasoning: string;
}

/**
 * Parsed task from natural language input
 */
export interface ParsedTask {
	title: string;
	content?: string;
	priority?: TaskPriority;
	dueDate?: string;
	confidence: number;
}

/**
 * Task recommendation with urgency scoring
 */
export interface TaskRecommendation {
	task: Task;
	reason: string;
	urgencyScore: number;
}

/**
 * AI Agent Service for task management assistance
 */
export interface AIAgentService {
	generateTaskSuggestions(
		workspaceId: string,
		context?: string,
	): Promise<TaskSuggestion[]>;
	parseNaturalLanguageTask(input: string): Promise<ParsedTask>;
	queryTasks(workspaceId: string, query: string): Promise<Task[]>;
	getTaskRecommendations(
		workspaceId: string,
		userId: string,
	): Promise<TaskRecommendation[]>;
}

/**
 * Zod schemas for AI response validation
 */
const TaskSuggestionSchema = z.object({
	title: z.string().min(1).max(200),
	content: z.string().optional(),
	priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
	estimatedDuration: z.string().optional(),
	reasoning: z.string().min(1),
});

const ParsedTaskSchema = z.object({
	title: z.string().min(1).max(200),
	content: z.string().optional(),
	priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
	dueDate: z.string().optional(),
	confidence: z.number().min(0).max(1),
});

const _TaskRecommendationSchema = z.object({
	taskId: z.string(),
	reason: z.string().min(1),
	urgencyScore: z.number().min(0).max(10),
});

/**
 * Implementation of AI Agent Service
 */
export class AIAgentServiceImpl implements AIAgentService {
	private model = getModel();

	/**
	 * Generate task suggestions based on workspace context
	 */
	async generateTaskSuggestions(
		workspaceId: string,
		context?: string,
	): Promise<TaskSuggestion[]> {
		try {
			const prompt = `You are a helpful task management assistant. Generate 3-5 relevant task suggestions for a user's workspace.

Context: ${context || "General task management"}
Workspace ID: ${workspaceId}

Consider:
- Common productivity patterns
- Task breakdown and organization
- Priority levels based on context
- Realistic time estimates

Generate practical, actionable task suggestions that would help the user be more productive.`;

			const { object } = await generateObject({
				model: this.model,
				schema: z.object({
					suggestions: z.array(TaskSuggestionSchema).min(3).max(5),
				}),
				prompt,
			});

			// Ensure all suggestions have required fields
			return object.suggestions.map((suggestion) => ({
				title: suggestion.title || "Untitled Task",
				content: suggestion.content,
				priority: suggestion.priority,
				estimatedDuration: suggestion.estimatedDuration,
				reasoning: suggestion.reasoning || "AI-generated suggestion",
			}));
		} catch (error) {
			console.error("Error generating task suggestions:", error);
			// Return fallback suggestions
			return [
				{
					title: "Review and organize existing tasks",
					content:
						"Take time to review current tasks and organize them by priority",
					priority: "medium",
					estimatedDuration: "30 minutes",
					reasoning:
						"Regular task review helps maintain productivity and focus",
				},
			];
		}
	}

	/**
	 * Parse natural language input into structured task data
	 */
	async parseNaturalLanguageTask(input: string): Promise<ParsedTask> {
		try {
			const prompt = `Parse the following natural language input into a structured task.

Input: "${input}"

Extract:
- Title: Clear, concise task title
- Content: Additional details or description (if any)
- Priority: low, medium, high, or urgent (if mentioned or implied)
- Due date: ISO date string if a date/time is mentioned
- Confidence: How confident you are in the parsing (0.0 to 1.0)

Be conservative with confidence scores. Only use high confidence (>0.8) when the input is very clear.`;

			const { object } = await generateObject({
				model: this.model,
				schema: ParsedTaskSchema,
				prompt,
			});

			// Ensure required fields are present
			return {
				title: object.title || input.slice(0, 200),
				content: object.content,
				priority: object.priority,
				dueDate: object.dueDate,
				confidence: object.confidence || 0.5,
			};
		} catch (error) {
			console.error("Error parsing natural language task:", error);
			// Return fallback parsing
			return {
				title: input.slice(0, 200), // Truncate if too long
				confidence: 0.5,
			};
		}
	}

	/**
	 * Query tasks using natural language
	 * Note: This method requires access to TaskService to actually query tasks
	 * For now, it returns an empty array as a placeholder
	 */
	async queryTasks(workspaceId: string, query: string): Promise<Task[]> {
		try {
			// This would need to be implemented with actual task querying logic
			// For now, we'll parse the query to understand intent
			const prompt = `Parse this natural language query about tasks and determine what the user is looking for:

Query: "${query}"
Workspace ID: ${workspaceId}

Determine:
- What type of tasks they want (status, priority, date range)
- Any specific filters or criteria
- Sort order preferences

This is a placeholder implementation that would need integration with TaskService.`;

			const response = await generateText({
				model: this.model,
				prompt,
			});

			console.log("Query analysis:", response);

			// Placeholder: return empty array
			// In a full implementation, this would:
			// 1. Parse the query intent
			// 2. Convert to TaskService query parameters
			// 3. Execute the query and return results
			return [];
		} catch (error) {
			console.error("Error querying tasks:", error);
			return [];
		}
	}

	/**
	 * Get task recommendations based on user's tasks and patterns
	 * Note: This method requires access to TaskService to analyze existing tasks
	 * For now, it returns an empty array as a placeholder
	 */
	async getTaskRecommendations(
		workspaceId: string,
		userId: string,
	): Promise<TaskRecommendation[]> {
		try {
			// This would need to be implemented with actual task analysis
			// For now, we'll generate generic recommendations
			const prompt = `Generate task recommendations for a user based on their workspace activity.

Workspace ID: ${workspaceId}
User ID: ${userId}

Consider:
- Task completion patterns
- Overdue tasks
- Priority distribution
- Workload balance

This is a placeholder implementation that would need integration with TaskService to analyze existing tasks.`;

			const response = await generateText({
				model: this.model,
				prompt,
			});

			console.log("Recommendation analysis:", response);

			// Placeholder: return empty array
			// In a full implementation, this would:
			// 1. Fetch user's tasks from TaskService
			// 2. Analyze patterns and priorities
			// 3. Generate personalized recommendations
			return [];
		} catch (error) {
			console.error("Error generating task recommendations:", error);
			return [];
		}
	}
}

/**
 * Create a new AI Agent Service instance
 */
export function createAIAgentService(): AIAgentService {
	return new AIAgentServiceImpl();
}
