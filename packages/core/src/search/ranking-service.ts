// Ranking service for combining scores and ordering results

import type { RankedResult } from "../agent/types.js";

export interface RankingService {
	combineScores(results: RankedResult[]): Promise<RankedResult[]>;
	orderByScore(results: RankedResult[]): RankedResult[];
	checkPermissions(
		results: RankedResult[],
		userId: string,
	): Promise<RankedResult[]>;
}

// Placeholder implementation - will be implemented in later tasks
export class RankingServiceImpl implements RankingService {
	async combineScores(_results: RankedResult[]): Promise<RankedResult[]> {
		throw new Error("Score combination not yet implemented");
	}

	orderByScore(_results: RankedResult[]): RankedResult[] {
		throw new Error("Score ordering not yet implemented");
	}

	async checkPermissions(
		_results: RankedResult[],
		_userId: string,
	): Promise<RankedResult[]> {
		throw new Error("Permission checking not yet implemented");
	}
}
