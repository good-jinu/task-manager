import { browser } from "$app/environment";

export interface URLParams {
	oauthSuccess?: string;
	workspaceId?: string;
	openSettings?: boolean;
	openSignup?: boolean;
}

export class URLParamHandler {
	/**
	 * Parse URL parameters and return structured data
	 */
	parseParams(): URLParams {
		if (!browser) return {};

		const urlParams = new URLSearchParams(window.location.search);

		return {
			oauthSuccess: urlParams.get("oauth_success") || undefined,
			workspaceId: urlParams.get("workspace_id") || undefined,
			openSettings: urlParams.get("settings") === "true",
			openSignup: urlParams.get("signup") === "true",
		};
	}

	/**
	 * Clean up URL parameters after processing
	 */
	cleanupParams(paramsToRemove: string[]): void {
		if (!browser) return;

		const url = new URL(window.location.href);
		let hasChanges = false;

		for (const param of paramsToRemove) {
			if (url.searchParams.has(param)) {
				url.searchParams.delete(param);
				hasChanges = true;
			}
		}

		if (hasChanges) {
			window.history.replaceState({}, "", url.toString());
		}
	}

	/**
	 * Handle OAuth success parameters
	 */
	handleOAuthSuccess(
		params: URLParams,
		currentWorkspaceId: string | undefined,
		onSuccess: () => void,
	): void {
		if (
			params.oauthSuccess === "notion" &&
			params.workspaceId &&
			currentWorkspaceId === params.workspaceId
		) {
			onSuccess();
			this.cleanupParams(["oauth_success", "workspace_id"]);
		}
	}

	/**
	 * Handle settings parameter
	 */
	handleSettingsParam(params: URLParams, onOpenSettings: () => void): void {
		if (params.openSettings) {
			onOpenSettings();
			this.cleanupParams(["settings"]);
		}
	}

	/**
	 * Handle signup parameter
	 */
	handleSignupParam(params: URLParams, onOpenSignup: () => void): void {
		if (params.openSignup) {
			onOpenSignup();
			this.cleanupParams(["signup"]);
		}
	}
}

export const urlParamHandler = new URLParamHandler();
