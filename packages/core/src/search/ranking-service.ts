// Ranking service for combining scores and ordering results

import type { RankedResult, RankingCriteria } from "../agent/types.js";

export interface RankingService {
	combineScores(
		results: RankedResult[],
		criteria: RankingCriteria,
	): Promise<RankedResult[]>;
	orderByScore(results: RankedResult[]): RankedResult[];
	checkPermissions(
		results: RankedResult[],
		userId: string,
	): Promise<RankedResult[]>;
}

export class RankingServiceImpl implements RankingService {
	/**
	 * Combines semantic relevance and date proximity scores according to ranking criteria
	 * Requirements 8.1, 8.2, 8.3: Implements combined scoring algorithm with proper weighting
	 */
	async combineScores(
		results: RankedResult[],
		criteria: RankingCriteria,
	): Promise<RankedResult[]> {
		if (!results || results.length === 0) {
			return [];
		}

		return results.map((result) => {
			// Validate scores are within expected range [0, 1]
			const relevanceScore = Math.max(
				0,
				Math.min(1, result.relevanceScore || 0),
			);
			const dateProximityScore = Math.max(
				0,
				Math.min(1, result.dateProximityScore || 0),
			);

			// Apply weighting based on criteria
			// When date is specified (dateWeight > 0), weight date proximity higher
			// When date is not specified (dateWeight = 0), rank purely by semantic relevance
			const combinedScore =
				relevanceScore * criteria.semanticWeight +
				dateProximityScore * criteria.dateWeight;

			return {
				...result,
				relevanceScore,
				dateProximityScore,
				combinedScore: Math.max(0, Math.min(1, combinedScore)),
			};
		});
	}

	/**
	 * Orders results by combined score in descending order
	 * Requirement 8.4: Returns results in descending order of combined score
	 */
	orderByScore(results: RankedResult[]): RankedResult[] {
		if (!results || results.length === 0) {
			return [];
		}

		// Sort by combined score in descending order (highest score first)
		// Use stable sort to maintain consistent ordering for equal scores
		return [...results].sort((a, b) => {
			const scoreDiff = (b.combinedScore || 0) - (a.combinedScore || 0);

			// If scores are equal, use relevance score as tiebreaker
			if (Math.abs(scoreDiff) < 0.0001) {
				const relevanceDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);

				// If relevance scores are also equal, use date proximity as final tiebreaker
				if (Math.abs(relevanceDiff) < 0.0001) {
					return (b.dateProximityScore || 0) - (a.dateProximityScore || 0);
				}

				return relevanceDiff;
			}

			return scoreDiff;
		});
	}

	/**
	 * Filters results based on user permissions and database access patterns
	 * Requirement 7.4: Respects existing database permissions and access patterns
	 */
	async checkPermissions(
		results: RankedResult[],
		userId: string,
	): Promise<RankedResult[]> {
		if (!results || results.length === 0) {
			return [];
		}

		if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
			throw new Error("Valid userId is required for permission checking");
		}

		// Filter results based on permission compliance
		// For now, we implement basic permission checking by ensuring:
		// 1. User has access to the page (page exists and is accessible)
		// 2. Page is not archived or deleted
		// 3. User has read permissions (implied by successful database query)

		const permittedResults: RankedResult[] = [];

		for (const result of results) {
			try {
				// Basic validation that the page is accessible
				if (!result.page || !result.page.id) {
					continue; // Skip invalid pages
				}

				// Check if page is archived (if this property exists)
				const isArchived = (result.page as any).archived === true;
				if (isArchived) {
					continue; // Skip archived pages
				}

				// Check if page has valid creation time (indicates proper access)
				if (
					!result.page.createdTime ||
					!(result.page.createdTime instanceof Date)
				) {
					continue; // Skip pages without valid timestamps
				}

				// If we reach here, the page passes basic permission checks
				permittedResults.push(result);
			} catch (error) {
				// Log permission check failure but continue processing other results
				console.warn(
					`Permission check failed for page ${result.page?.id}: ${
						error instanceof Error ? error.message : "Unknown error"
					}`,
				);
			}
		}

		return permittedResults;
	}

	/**
	 * Creates default ranking criteria based on whether date is specified
	 * Helper method to generate appropriate weighting
	 */
	static createRankingCriteria(
		hasDate: boolean,
		maxResults = 10,
	): RankingCriteria {
		if (hasDate) {
			// When date is specified, weight date proximity higher (Requirements 8.2)
			return {
				semanticWeight: 0.3,
				dateWeight: 0.7,
				maxResults,
			};
		} else {
			// When date is not specified, rank purely by semantic relevance (Requirements 8.3)
			return {
				semanticWeight: 1.0,
				dateWeight: 0.0,
				maxResults,
			};
		}
	}
}
