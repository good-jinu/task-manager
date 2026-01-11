import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET /api/health
 * Simple health check endpoint for network connectivity testing
 * Used by the network resilience system to detect connection status
 */
export const GET: RequestHandler = async () => {
	try {
		// Simple health check - just return success
		// In a production environment, this could check database connectivity,
		// external service availability, etc.
		return json(
			{
				status: "healthy",
				timestamp: new Date().toISOString(),
				uptime: process.uptime(),
			},
			{
				status: 200,
				headers: {
					"Cache-Control": "no-cache, no-store, must-revalidate",
					Pragma: "no-cache",
					Expires: "0",
				},
			},
		);
	} catch (error) {
		console.error("Health check failed:", error);
		return json(
			{
				status: "unhealthy",
				timestamp: new Date().toISOString(),
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 503 },
		);
	}
};

/**
 * HEAD /api/health
 * Lightweight health check for network connectivity testing
 * Used by the network resilience system for periodic connectivity checks
 */
export const HEAD: RequestHandler = async () => {
	try {
		return new Response(null, {
			status: 200,
			headers: {
				"Cache-Control": "no-cache, no-store, must-revalidate",
				Pragma: "no-cache",
				Expires: "0",
			},
		});
	} catch (error) {
		console.error("Health check failed:", error);
		return new Response(null, { status: 503 });
	}
};
