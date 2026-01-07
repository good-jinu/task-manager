<script lang="ts">
import type { ExternalIntegration, SyncStatus } from "@notion-task-manager/db";
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
	syncStatus?: SyncStatus;
	size?: "sm" | "md" | "lg";
	showIcon?: boolean;
	class?: string;
}

let {
	integration,
	syncStatus,
	size = "sm",
	showIcon = true,
	class: className = "",
}: Props = $props();

// Determine the actual status
const status = $derived(() => {
	if (!integration) return "disconnected";
	if (!integration.syncEnabled) return "disabled";

	// Use provided syncStatus or derive from integration
	if (syncStatus) return syncStatus;

	// In a real implementation, you'd check sync metadata
	// For now, assume 'synced' if enabled and recently synced
	if (integration.lastSyncAt) {
		const lastSync = new Date(integration.lastSyncAt);
		const now = new Date();
		const hoursSinceSync =
			(now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);

		// If last sync was more than 24 hours ago, show as pending
		return hoursSinceSync > 24 ? "pending" : "synced";
	}

	return "pending";
});

const statusConfig = {
	disconnected: {
		label: "Not Connected",
		color: "bg-gray-100 text-gray-700 border-gray-200",
		icon: Database,
		iconColor: "text-gray-500",
	},
	disabled: {
		label: "Disabled",
		color: "bg-gray-100 text-gray-700 border-gray-200",
		icon: Database,
		iconColor: "text-gray-400",
	},
	synced: {
		label: "Synced",
		color: "bg-green-50 text-green-700 border-green-200",
		icon: Success,
		iconColor: "text-green-600",
	},
	pending: {
		label: "Syncing",
		color: "bg-yellow-50 text-yellow-700 border-yellow-200",
		icon: Spinner,
		iconColor: "text-yellow-600",
	},
	conflict: {
		label: "Conflict",
		color: "bg-orange-50 text-orange-700 border-orange-200",
		icon: Warning,
		iconColor: "text-orange-600",
	},
	error: {
		label: "Error",
		color: "bg-red-50 text-red-700 border-red-200",
		icon: ErrorIcon,
		iconColor: "text-red-600",
	},
};

const currentStatus = $derived(statusConfig[status()]);

const sizeClasses = {
	sm: "text-xs px-2 py-1",
	md: "text-sm px-2.5 py-1.5",
	lg: "text-base px-3 py-2",
};

const iconSizes = {
	sm: "w-3 h-3",
	md: "w-4 h-4",
	lg: "w-5 h-5",
};
</script>

<span class={cn(
	'inline-flex items-center gap-1.5 rounded-full border font-medium',
	currentStatus.color,
	sizeClasses[size],
	className
)}>
	{#if showIcon}
		{@const IconComponent = currentStatus.icon}
		<IconComponent 
			class={cn(iconSizes[size], currentStatus.iconColor)}
		/>
	{/if}
	{currentStatus.label}
</span>