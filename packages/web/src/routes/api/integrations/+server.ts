import { IntegrationService } from "@notion-task-manager/db";
import { handleGet, handlePost } from "$lib/server";
import type { RequestHandler } from "./$types";

/**
 * POST /api/integrations
 * Creates a new external integration for a workspace
 */
export const POST: RequestHandler = async (event) => {
	return handlePost(
		event,
		async (event, _authResult) => {
			const {
				workspaceId,
				provider,
				externalId,
				config,
				syncEnabled = true,
			} = await event.request.json();

			// Validate required fields
			if (!workspaceId) {
				throw new Error("workspaceId is required");
			}

			if (!provider) {
				throw new Error("provider is required");
			}

			if (!externalId) {
				throw new Error("externalId is required");
			}

			if (!config || typeof config !== "object") {
				throw new Error("config is required and must be an object");
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

				return {
					success: true,
					integration,
				};
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes("already exists")
				) {
					const conflictError = new Error(
						"Integration with this provider already exists for this workspace",
					);
					(conflictError as any).status = 409;
					throw conflictError;
				}
				throw error;
			}
		},
		{ requireAuth: true },
	);
};

/**
 * GET /api/integrations?workspaceId=xxx
 * Lists all integrations for a workspace
 */
export const GET: RequestHandler = async (event) => {
	return handleGet(
		event,
		async (event, _authResult) => {
			const workspaceId = event.url.searchParams.get("workspaceId");

			if (!workspaceId) {
				throw new Error("workspaceId parameter is required");
			}

			// List integrations
			const integrationService = new IntegrationService();
			const integrations =
				await integrationService.listIntegrations(workspaceId);

			return {
				integrations,
			};
		},
		{ requireAuth: true },
	);
};
