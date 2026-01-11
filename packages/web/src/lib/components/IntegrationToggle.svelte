<script lang="ts">
import { Switch } from "bits-ui";
import {
	classifyOAuthError,
	initiateOAuth,
	OAuthRetryManager,
} from "$lib/utils/oauth";
import DatabaseSelector from "./DatabaseSelector.svelte";
import { Database, Spinner } from "./icons";
import { cn } from "./utils";

interface NotionDatabase {
	id: string;
	title: string;
	url?: string;
	icon?: {
		type: "emoji" | "external" | "file";
		emoji?: string;
		external?: { url: string };
		file?: { url: string };
	};
}

interface IntegrationConfig {
	enabled: boolean;
	databaseId?: string;
}

interface Props {
	integration?: IntegrationConfig;
	loading?: boolean;
	disabled?: boolean;
	workspaceId: string;
	onToggle: (enabled: boolean) => Promise<void>;
	onDatabaseChange?: (databaseId: string) => void;
	class?: string;
	// Database selection
	availableDatabases?: NotionDatabase[];
	currentDatabase?: NotionDatabase | null;
}

let {
	integration,
	loading = false,
	disabled = false,
	workspaceId,
	onToggle,
	onDatabaseChange,
	class: className = "",
	availableDatabases = [],
	currentDatabase = null,
}: Props = $props();

let isToggling = $state(false);
let oauthError = $state<string | null>(null);
let retryManager = new OAuthRetryManager();

async function handleSwitchChange(checked: boolean) {
	if (isToggling || loading || disabled) return;

	isToggling = true;
	oauthError = null;

	try {
		if (checked && !integration) {
			// Enabling integration for the first time - check if user has Notion tokens
			// If they do, show database selection; if not, initiate OAuth
			await handleIntegrationSetup();
		} else {
			// Just toggling existing integration
			await onToggle(checked);
		}
	} catch (error) {
		console.error("Toggle error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Failed to toggle integration";
		oauthError = errorMessage;
	} finally {
		isToggling = false;
	}
}

async function handleIntegrationSetup() {
	try {
		// First, check if user has Notion access tokens by trying to fetch databases
		const response = await fetch("/api/integrations/notion/databases");

		if (response.ok) {
			// User has tokens, they need to select a database
			// This will be handled by the DatabaseSelector component
			console.log("User has Notion tokens, database selection available");
		} else if (response.status === 401 || response.status === 403) {
			// User doesn't have tokens or they're invalid, initiate OAuth
			await handleOAuthFlow();
		} else {
			// Other error
			const errorData = await response.json();
			throw new Error(errorData.error || "Failed to check Notion access");
		}
	} catch (error) {
		console.error("Integration setup error:", error);
		throw error;
	}
}

async function handleOAuthFlow() {
	try {
		const result = await retryManager.retry(async () => {
			return await initiateOAuth({
				provider: "notion",
				workspaceId,
			});
		});

		if (!result.success) {
			throw new Error(result.error || "OAuth initiation failed");
		}

		// OAuth initiation successful - user will be redirected
		console.log("OAuth initiated successfully");
	} catch (error) {
		console.error("OAuth flow error:", error);
		const errorMessage =
			error instanceof Error ? error.message : "OAuth failed";
		const classifiedError = classifyOAuthError(errorMessage);

		oauthError = classifiedError.message;
		throw error;
	}
}

async function handleRetryOAuth() {
	oauthError = null;
	retryManager.reset();
	await handleOAuthFlow();
}

async function handleDatabaseChange(databaseId: string) {
	if (onDatabaseChange) {
		await onDatabaseChange(databaseId);
	}
}

async function handleSetupNotion() {
	await handleIntegrationSetup();
}
</script>

<div class={cn(
	'flex flex-col gap-3 p-4 bg-surface-base border border-subtle-base rounded-lg',
	disabled && 'opacity-60 pointer-events-none',
	className
)}>
	<!-- Header Section -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3 flex-1 min-w-0">
			<div class="flex-shrink-0">
				<Database class="w-5 h-5 text-foreground-secondary" />
			</div>
			<div class="min-w-0 flex-1">
				<h3 class="font-medium text-foreground-base text-sm">Notion Integration</h3>
			</div>
		</div>
		
		{#if integration}
			<!-- Toggle Switch -->
			<div class="relative flex-shrink-0">
				<Switch.Root
					checked={integration.enabled}
					onCheckedChange={handleSwitchChange}
					disabled={isToggling || loading || disabled}
					class="data-[state=checked]:bg-primary data-[state=unchecked]:bg-surface-muted inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Switch.Thumb class="pointer-events-none block h-4 w-4 rounded-full bg-surface-base shadow-sm transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
				</Switch.Root>
				
				<!-- Loading indicator overlay -->
				{#if isToggling}
					<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
						<Spinner class="w-3 h-3 text-primary" />
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Description -->
	<p class="text-xs text-foreground-secondary">
		{#if !integration}
			Connect your Notion workspace to manage tasks
		{:else if integration.enabled}
			Integration is enabled
		{:else}
			Integration is disabled
		{/if}
	</p>

	<!-- Database Selector -->
	<div class="flex items-center gap-2">
		<div class="flex-1 min-w-0">
			<DatabaseSelector
				databases={availableDatabases}
				currentDatabase={currentDatabase}
				onDatabaseChange={handleDatabaseChange}
				onSetupNotion={handleSetupNotion}
				disabled={disabled || loading}
				loading={loading}
			/>
		</div>
	</div>

	<!-- Error Display -->
	{#if oauthError}
		<div class="flex items-center gap-2 p-2 bg-error-alert-bg border border-error-border rounded-md">
			<p class="text-xs text-error font-medium flex-1">
				{oauthError}
			</p>
			<button
				onclick={handleRetryOAuth}
				class="text-xs text-primary hover:text-primary-button-hover underline flex-shrink-0"
			>
				Retry
			</button>
		</div>
	{/if}
</div>