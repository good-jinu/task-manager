<script lang="ts">
import type { ExternalIntegration } from "@notion-task-manager/db";
import {
	Database,
	Error as ErrorIcon,
	Spinner,
	Success,
	Warning,
} from "./icons";
import { Badge } from "./ui";
import { cn } from "./utils";

interface Props {
	integration?: ExternalIntegration;
	loading?: boolean;
	onToggle: (enabled: boolean) => Promise<void>;
	onConfigure?: () => void;
	class?: string;
}

let {
	integration,
	loading = false,
	onToggle,
	onConfigure,
	class: className = "",
}: Props = $props();

let isToggling = $state(false);

async function handleToggle() {
	if (isToggling || loading) return;

	isToggling = true;
	try {
		const newState = !integration?.syncEnabled;
		await onToggle(newState);
	} finally {
		isToggling = false;
	}
}

function handleConfigure() {
	if (onConfigure) {
		onConfigure();
	}
}

// Determine status
const status = $derived(() => {
	if (!integration) return "disconnected";
	if (!integration.syncEnabled) return "disabled";

	// In a real implementation, you'd check sync metadata for actual status
	// For now, we'll assume 'synced' if enabled
	return "synced";
});

const statusConfig = {
	disconnected: {
		label: "Not Connected",
		color: "bg-gray-100 text-gray-800",
		icon: Database,
	},
	disabled: {
		label: "Disabled",
		color: "bg-gray-100 text-gray-800",
		icon: Database,
	},
	synced: {
		label: "Synced",
		color: "bg-green-100 text-green-800",
		icon: Success,
	},
	pending: {
		label: "Syncing",
		color: "bg-yellow-100 text-yellow-800",
		icon: Spinner,
	},
	error: {
		label: "Error",
		color: "bg-red-100 text-red-800",
		icon: ErrorIcon,
	},
};

const currentStatus = $derived(statusConfig[status()]);
</script>

<div class={cn('flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg', className)}>
	<div class="flex items-center gap-3">
		<div class="flex-shrink-0">
			<Database class="w-6 h-6 text-gray-600" />
		</div>
		
		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2 mb-1">
				<h3 class="font-medium text-gray-900">Notion Integration</h3>
				<Badge variant="secondary" class={currentStatus.color}>
					{@const IconComponent = currentStatus.icon}
					<div class="flex items-center gap-1">
						<IconComponent class="w-3 h-3" />
						{currentStatus.label}
					</div>
				</Badge>
			</div>
			
			<p class="text-sm text-gray-600">
				{#if !integration}
					Connect your Notion workspace to sync tasks
				{:else if !integration.syncEnabled}
					Sync is disabled. Tasks won't sync with Notion.
				{:else}
					Tasks are syncing with your Notion database
				{/if}
			</p>
			
			{#if integration?.lastSyncAt}
				<p class="text-xs text-gray-500 mt-1">
					Last synced: {new Date(integration.lastSyncAt).toLocaleString()}
				</p>
			{/if}
		</div>
	</div>

	<div class="flex items-center gap-2">
		{#if integration}
			<!-- Toggle switch -->
			<button
				onclick={handleToggle}
				disabled={isToggling || loading}
				class={cn(
					'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
					'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
					'disabled:opacity-50 disabled:cursor-not-allowed',
					'min-w-[44px] min-h-[44px] flex items-center justify-center', // Expand touch target
					integration.syncEnabled ? 'bg-blue-600' : 'bg-gray-200'
				)}
				aria-label={integration.syncEnabled ? 'Disable sync' : 'Enable sync'}
			>
				<span
					class={cn(
						'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
						integration.syncEnabled ? 'translate-x-6' : 'translate-x-1'
					)}
				></span>
				{#if isToggling}
					<div class="absolute inset-0 flex items-center justify-center">
						<Spinner class="w-3 h-3 text-white" />
					</div>
				{/if}
			</button>

			<!-- Configure button -->
			{#if onConfigure}
				<button
					onclick={handleConfigure}
					class={cn(
						'px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100',
						'hover:bg-gray-200 rounded-md transition-colors',
						'min-h-[44px] flex items-center'
					)}
				>
					Configure
				</button>
			{/if}
		{:else}
			<!-- Connect button -->
			<button
				onclick={() => onToggle(true)}
				disabled={loading}
				class={cn(
					'px-4 py-2 text-sm font-medium text-white bg-blue-600',
					'hover:bg-blue-700 rounded-md transition-colors',
					'disabled:opacity-50 disabled:cursor-not-allowed',
					'min-h-[44px] flex items-center gap-2'
				)}
			>
				{#if loading}
					<Spinner class="w-4 h-4" />
				{/if}
				Connect Notion
			</button>
		{/if}
	</div>
</div>