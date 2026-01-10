import {
	DeleteCommand,
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient, getTableName } from "./client";
import type {
	CreateSyncStatisticsInput,
	SyncHistoryEntry,
	SyncStatistics,
	UpdateSyncStatisticsInput,
} from "./types";
import { validateIntegrationId } from "./validation";

/**
 * Service for managing sync statistics and monitoring data
 */
export class SyncStatisticsService {
	private client = getDynamoDBClient();
	private get tableName() {
		return getTableName("syncStatistics");
	}
	private get historyTableName() {
		return getTableName("syncHistory");
	}

	/**
	 * Creates or updates sync statistics for an integration
	 */
	async upsertSyncStatistics(
		integrationId: string,
		statisticsData: CreateSyncStatisticsInput,
	): Promise<SyncStatistics> {
		// Validate input
		validateIntegrationId(integrationId);

		const _now = new Date();
		const statistics: SyncStatistics = {
			integrationId,
			totalSyncAttempts: statisticsData.totalSyncAttempts || 0,
			successfulSyncs: statisticsData.successfulSyncs || 0,
			failedSyncs: statisticsData.failedSyncs || 0,
			conflictCount: statisticsData.conflictCount || 0,
			averageSyncDuration: statisticsData.averageSyncDuration || 0,
			lastSyncAt: statisticsData.lastSyncAt || null,
			lastSyncAttemptAt: statisticsData.lastSyncAttemptAt || null,
			lastSyncDuration: statisticsData.lastSyncDuration || null,
			lastSyncError: statisticsData.lastSyncError || null,
			lastSyncErrorAt: statisticsData.lastSyncErrorAt || null,
			manualSyncCount: statisticsData.manualSyncCount || 0,
			lastManualSyncAt: statisticsData.lastManualSyncAt || null,
		};

		try {
			await this.client.send(
				new PutCommand({
					TableName: this.tableName,
					Item: statistics,
				}),
			);

			return statistics;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to upsert sync statistics: ${error.message}`);
			}
			throw new Error("Failed to upsert sync statistics: Unknown error");
		}
	}

	/**
	 * Retrieves sync statistics for an integration
	 */
	async getSyncStatistics(
		integrationId: string,
	): Promise<SyncStatistics | null> {
		// Validate input
		validateIntegrationId(integrationId);

		try {
			const result = await this.client.send(
				new GetCommand({
					TableName: this.tableName,
					Key: { integrationId },
				}),
			);

			return (result.Item as SyncStatistics) || null;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to get sync statistics: ${error.message}`);
			}
			throw new Error("Failed to get sync statistics: Unknown error");
		}
	}

	/**
	 * Updates existing sync statistics
	 */
	async updateSyncStatistics(
		integrationId: string,
		updates: UpdateSyncStatisticsInput,
	): Promise<SyncStatistics> {
		// Validate inputs
		validateIntegrationId(integrationId);

		const updateExpressions: string[] = [];
		const expressionAttributeNames: Record<string, string> = {};
		const expressionAttributeValues: Record<string, unknown> = {};

		// Build update expression dynamically
		for (const [key, value] of Object.entries(updates)) {
			if (value !== undefined) {
				updateExpressions.push(`#${key} = :${key}`);
				expressionAttributeNames[`#${key}`] = key;
				expressionAttributeValues[`:${key}`] = value;
			}
		}

		if (updateExpressions.length === 0) {
			throw new Error("No valid updates provided");
		}

		try {
			const result = await this.client.send(
				new UpdateCommand({
					TableName: this.tableName,
					Key: { integrationId },
					UpdateExpression: `SET ${updateExpressions.join(", ")}`,
					ExpressionAttributeNames: expressionAttributeNames,
					ExpressionAttributeValues: expressionAttributeValues,
					ReturnValues: "ALL_NEW",
				}),
			);

			return result.Attributes as SyncStatistics;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to update sync statistics: ${error.message}`);
			}
			throw new Error("Failed to update sync statistics: Unknown error");
		}
	}

	/**
	 * Increments sync attempt counters
	 */
	async incrementSyncAttempt(
		integrationId: string,
		success: boolean,
		duration?: number,
		error?: string,
	): Promise<SyncStatistics> {
		validateIntegrationId(integrationId);

		const now = new Date();
		const updates: UpdateSyncStatisticsInput = {
			lastSyncAttemptAt: now,
		};

		if (success) {
			updates.lastSyncAt = now;
			if (duration !== undefined) {
				updates.lastSyncDuration = duration;
			}
			// Clear any previous error
			updates.lastSyncError = null;
			updates.lastSyncErrorAt = null;
		} else {
			if (error) {
				updates.lastSyncError = error;
				updates.lastSyncErrorAt = now;
			}
		}

		try {
			// Use atomic counters for increment operations
			const result = await this.client.send(
				new UpdateCommand({
					TableName: this.tableName,
					Key: { integrationId },
					UpdateExpression: success
						? "ADD totalSyncAttempts :one, successfulSyncs :one SET lastSyncAt = :now, lastSyncAttemptAt = :now" +
							(duration !== undefined ? ", lastSyncDuration = :duration" : "") +
							", lastSyncError = :null, lastSyncErrorAt = :null"
						: "ADD totalSyncAttempts :one, failedSyncs :one SET lastSyncAttemptAt = :now" +
							(error ? ", lastSyncError = :error, lastSyncErrorAt = :now" : ""),
					ExpressionAttributeValues: {
						":one": 1,
						":now": now,
						":null": null,
						...(duration !== undefined && { ":duration": duration }),
						...(error && { ":error": error }),
					},
					ReturnValues: "ALL_NEW",
				}),
			);

			const statistics = result.Attributes as SyncStatistics;

			// Recalculate average duration if we have a new successful sync
			if (success && duration !== undefined && statistics.successfulSyncs > 0) {
				const newAverage = this.calculateAverageDuration(
					statistics.averageSyncDuration || 0,
					duration,
					statistics.successfulSyncs,
				);

				await this.client.send(
					new UpdateCommand({
						TableName: this.tableName,
						Key: { integrationId },
						UpdateExpression: "SET averageSyncDuration = :avg",
						ExpressionAttributeValues: {
							":avg": newAverage,
						},
					}),
				);

				statistics.averageSyncDuration = newAverage;
			}

			return statistics;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to increment sync attempt: ${error.message}`);
			}
			throw new Error("Failed to increment sync attempt: Unknown error");
		}
	}

	/**
	 * Increments manual sync counter
	 */
	async incrementManualSync(integrationId: string): Promise<SyncStatistics> {
		validateIntegrationId(integrationId);

		const now = new Date();

		try {
			const result = await this.client.send(
				new UpdateCommand({
					TableName: this.tableName,
					Key: { integrationId },
					UpdateExpression:
						"ADD manualSyncCount :one SET lastManualSyncAt = :now",
					ExpressionAttributeValues: {
						":one": 1,
						":now": now,
					},
					ReturnValues: "ALL_NEW",
				}),
			);

			return result.Attributes as SyncStatistics;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to increment manual sync: ${error.message}`);
			}
			throw new Error("Failed to increment manual sync: Unknown error");
		}
	}

	/**
	 * Records a sync history entry for detailed monitoring
	 */
	async recordSyncHistory(
		integrationId: string,
		historyEntry: Omit<SyncHistoryEntry, "id" | "integrationId" | "timestamp">,
	): Promise<SyncHistoryEntry> {
		validateIntegrationId(integrationId);

		const now = new Date();
		const entry: SyncHistoryEntry = {
			id: `${integrationId}-${now.getTime()}`,
			integrationId,
			timestamp: now,
			...historyEntry,
		};

		try {
			await this.client.send(
				new PutCommand({
					TableName: this.historyTableName,
					Item: entry,
				}),
			);

			return entry;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to record sync history: ${error.message}`);
			}
			throw new Error("Failed to record sync history: Unknown error");
		}
	}

	/**
	 * Gets sync history for an integration
	 */
	async getSyncHistory(
		integrationId: string,
		limit: number = 50,
		startTime?: Date,
		endTime?: Date,
	): Promise<SyncHistoryEntry[]> {
		validateIntegrationId(integrationId);

		try {
			let keyConditionExpression = "integrationId = :integrationId";
			const expressionAttributeValues: Record<string, string | number> = {
				":integrationId": integrationId,
			};

			// Add time range filtering if provided
			if (startTime && endTime) {
				keyConditionExpression +=
					" AND #timestamp BETWEEN :startTime AND :endTime";
				expressionAttributeValues[":startTime"] = startTime.toISOString();
				expressionAttributeValues[":endTime"] = endTime.toISOString();
			} else if (startTime) {
				keyConditionExpression += " AND #timestamp >= :startTime";
				expressionAttributeValues[":startTime"] = startTime.toISOString();
			} else if (endTime) {
				keyConditionExpression += " AND #timestamp <= :endTime";
				expressionAttributeValues[":endTime"] = endTime.toISOString();
			}

			const result = await this.client.send(
				new QueryCommand({
					TableName: this.historyTableName,
					KeyConditionExpression: keyConditionExpression,
					ExpressionAttributeValues: expressionAttributeValues,
					...(startTime || endTime
						? {
								ExpressionAttributeNames: {
									"#timestamp": "timestamp",
								},
							}
						: {}),
					ScanIndexForward: false, // Sort by timestamp descending (newest first)
					Limit: limit,
				}),
			);

			return (result.Items as SyncHistoryEntry[]) || [];
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to get sync history: ${error.message}`);
			}
			throw new Error("Failed to get sync history: Unknown error");
		}
	}

	/**
	 * Gets sync performance metrics for an integration
	 */
	async getSyncPerformanceMetrics(
		integrationId: string,
		days: number = 7,
	): Promise<{
		successRate: number;
		averageResponseTime: number;
		totalSyncs: number;
		errorRate: number;
		conflictRate: number;
		dailyStats: Array<{
			date: string;
			syncs: number;
			errors: number;
			averageDuration: number;
		}>;
	}> {
		validateIntegrationId(integrationId);

		const endTime = new Date();
		const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);

		try {
			// Get current statistics
			const stats = await this.getSyncStatistics(integrationId);

			// Get history for the specified period
			const history = await this.getSyncHistory(
				integrationId,
				1000,
				startTime,
				endTime,
			);

			// Calculate metrics
			const totalSyncs = stats?.totalSyncAttempts || 0;
			const successfulSyncs = stats?.successfulSyncs || 0;
			const failedSyncs = stats?.failedSyncs || 0;
			const conflicts = stats?.conflictCount || 0;

			const successRate =
				totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;
			const errorRate = totalSyncs > 0 ? (failedSyncs / totalSyncs) * 100 : 0;
			const conflictRate = totalSyncs > 0 ? (conflicts / totalSyncs) * 100 : 0;

			// Group history by day for daily stats
			const dailyStatsMap = new Map<
				string,
				{
					syncs: number;
					errors: number;
					totalDuration: number;
					successfulSyncs: number;
				}
			>();

			for (const entry of history) {
				const dateKey = entry.timestamp.toISOString().split("T")[0];
				const existing = dailyStatsMap.get(dateKey) || {
					syncs: 0,
					errors: 0,
					totalDuration: 0,
					successfulSyncs: 0,
				};

				existing.syncs++;
				if (entry.success) {
					existing.successfulSyncs++;
					if (entry.duration) {
						existing.totalDuration += entry.duration;
					}
				} else {
					existing.errors++;
				}

				dailyStatsMap.set(dateKey, existing);
			}

			const dailyStats = Array.from(dailyStatsMap.entries()).map(
				([date, data]) => ({
					date,
					syncs: data.syncs,
					errors: data.errors,
					averageDuration:
						data.successfulSyncs > 0
							? data.totalDuration / data.successfulSyncs
							: 0,
				}),
			);

			return {
				successRate: Math.round(successRate * 100) / 100,
				averageResponseTime: stats?.averageSyncDuration || 0,
				totalSyncs,
				errorRate: Math.round(errorRate * 100) / 100,
				conflictRate: Math.round(conflictRate * 100) / 100,
				dailyStats: dailyStats.sort((a, b) => a.date.localeCompare(b.date)),
			};
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to get performance metrics: ${error.message}`);
			}
			throw new Error("Failed to get performance metrics: Unknown error");
		}
	}

	/**
	 * Deletes sync statistics for an integration
	 */
	async deleteSyncStatistics(integrationId: string): Promise<void> {
		validateIntegrationId(integrationId);

		try {
			await this.client.send(
				new DeleteCommand({
					TableName: this.tableName,
					Key: { integrationId },
				}),
			);
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to delete sync statistics: ${error.message}`);
			}
			throw new Error("Failed to delete sync statistics: Unknown error");
		}
	}

	/**
	 * Calculate average sync duration using moving average
	 */
	private calculateAverageDuration(
		currentAverage: number,
		newDuration: number,
		totalCount: number,
	): number {
		if (totalCount <= 1) {
			return newDuration;
		}

		// Simple moving average
		const newAverage =
			(currentAverage * (totalCount - 1) + newDuration) / totalCount;
		return Math.round(newAverage);
	}
}
