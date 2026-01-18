import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Resource } from "sst";
import type { QueueSendResult, TaskExecutionMessage } from "./types";

/**
 * Task Queue Service
 * Handles sending task execution messages to SQS
 */
export class TaskQueueService {
	private client: SQSClient;
	private queueUrl: string;

	constructor() {
		console.log("[TaskQueueService] Initializing SQS client");
		this.client = new SQSClient({
			region: process.env.AWS_REGION || "us-east-1",
		});
		// biome-ignore lint/suspicious/noExplicitAny: Resource for any
		this.queueUrl = (Resource as any).TaskQueue.url;
		console.log("[TaskQueueService] Queue URL:", this.queueUrl);
	}

	/**
	 * Send a task execution message to the queue
	 */
	async sendTaskExecution(
		message: TaskExecutionMessage,
	): Promise<QueueSendResult> {
		console.log("[TaskQueueService.sendTaskExecution] Sending message:", {
			userId: message.userId,
			executionId: message.executionId,
			workspaceId: message.workspaceId,
			query: message.query,
			contextTasksCount: message.contextTasks.length,
		});

		try {
			const command = new SendMessageCommand({
				QueueUrl: this.queueUrl,
				MessageBody: JSON.stringify(message),
				MessageAttributes: {
					userId: {
						DataType: "String",
						StringValue: message.userId,
					},
					executionId: {
						DataType: "String",
						StringValue: message.executionId,
					},
					workspaceId: {
						DataType: "String",
						StringValue: message.workspaceId,
					},
				},
			});

			const response = await this.client.send(command);
			console.log("[TaskQueueService.sendTaskExecution] Message sent:", {
				messageId: response.MessageId,
			});

			return {
				success: true,
				messageId: response.MessageId,
			};
		} catch (error) {
			console.error(
				"[TaskQueueService.sendTaskExecution] Failed to send message:",
				error,
			);
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			return {
				success: false,
				error: errorMessage,
			};
		}
	}
}
