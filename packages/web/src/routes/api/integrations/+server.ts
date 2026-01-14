import {
	TaskIntegrationService,
	WorkspaceIntegrationService,
} from "@task-manager/db";
import { handleGet, handlePost } from "$lib/server";
import type { RequestHandler } from "./$types";

/**
 * POST /api/integrations
 * Creates a new workspace integration
 */
export const POST: RequestHandler = async (event) => {
	return handlePost(
		event,
		async (event) => {
			const { workspaceId, provider, externalId, config, syncEnabled } =
				await event.request.json();

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

			// Create workspace integration
			const workspaceIntegrationService = new WorkspaceIntegrationService();

			try {
				// Check if integration already exists for this workspace and provider
				const existingIntegration =
					await workspaceIntegrationService.findByWorkspaceAndProvider(
						workspaceId,
						provider,
					);

				if (existingIntegration) {
					const conflictError = new Error(
						`Integration for ${provider} already exists in this workspace`,
					);
					(conflictError as Error & { status: number }).status = 409;
					throw conflictError;
				}

				const integration = await workspaceIntegrationService.create({
					workspaceId,
					provider,
					externalId,
					config: config || {},
					syncEnabled: syncEnabled ?? true,
				});

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
						"Integration for this workspace already exists",
					);
					(conflictError as Error & { status: number }).status = 409;
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
 * Lists workspace integrations
 */
export const GET: RequestHandler = async (event) => {
	return handleGet(
		event,
		async (event) => {
			const workspaceId = event.url.searchParams.get("workspaceId");

			if (!workspaceId) {
				throw new Error("workspaceId parameter is required");
			}

			const workspaceIntegrationService = new WorkspaceIntegrationService();
			const integrations =
				await workspaceIntegrationService.listByWorkspace(workspaceId);

			return {
				integrations,
			};
		},
		{ requireAuth: true },
	);
};
