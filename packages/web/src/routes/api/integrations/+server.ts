import { IntegrationService, ValidationError } from "@notion-task-manager/db";
import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/auth";
import type { RequestHandler } from "./$types";

/**
 * POST /api/integrations
 * Creates a new external integration for a workspace
 */
export const POST: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		const {
			workspaceId,
			provider,
			externalId,
			config,
			syncEnabled = true,
		} = await event.request.json();

		// Validate required fields
		if (!workspaceId) {
			return json({ error: "workspaceId is required" }, { status: 400 });
		}

		if (!provider) {
			return json({ error: "provider is required" }, { status: 400 });
		}

		if (!externalId) {
			return json({ error: "externalId is required" }, { status: 400 });
		}

		if (!config || typeof config !== "object") {
			return json(
				{ error: "config is required and must be an object" },
				{ status: 400 },
			);
		}

		// Create integration
		const integrationService = new IntegrationService();

		try {
			const integration = await integrationService.createIntegration(
				workspaceId,
				{
					provider,
					externalId,
					config,
					syncEnabled,
				},
			);

			return json({
				success: true,
				integration,
			});
		} catch (error) {
			if (error instanceof Error && error.message.includes("already exists")) {
				return json(
					{
						error:
							"Integration with this provider already exists for this workspace",
					},
					{ status: 409 },
				);
			}
			throw error;
		}
	} catch (error) {
		console.error("Failed to create integration:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		if (error instanceof ValidationError) {
			return json(
				{
					error: error.message,
				},
				{ status: 400 },
			);
		}

		return json(
			{
				error: "Failed to create integration",
			},
			{ status: 500 },
		);
	}
};

/**
 * GET /api/integrations?workspaceId=xxx
 * Lists all integrations for a workspace
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Require authentication
		const session = await requireAuth(event);

		const workspaceId = event.url.searchParams.get("workspaceId");

		if (!workspaceId) {
			return json(
				{ error: "workspaceId parameter is required" },
				{ status: 400 },
			);
		}

		// List integrations
		const integrationService = new IntegrationService();
		const integrations = await integrationService.listIntegrations(workspaceId);

		return json({
			integrations,
		});
	} catch (error) {
		console.error("Failed to list integrations:", error);

		if (error instanceof Error && error.message.includes("redirect")) {
			// Re-throw redirect errors from requireAuth
			throw error;
		}

		return json(
			{
				error: "Failed to list integrations",
			},
			{ status: 500 },
		);
	}
};
