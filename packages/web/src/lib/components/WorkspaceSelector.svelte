<script lang="ts">
import type { Workspace } from "@notion-task-manager/db";
import { Select } from "bits-ui";
import { Check, KeyboardArrowDown, Plus } from "./icons";

interface Props {
	workspaces: Workspace[];
	currentWorkspace: Workspace | null;
	onWorkspaceChange?: (workspaceId: string) => void;
	onCreateWorkspace?: () => void;
	disabled?: boolean;
}

let {
	workspaces = [],
	currentWorkspace = null,
	onWorkspaceChange,
	onCreateWorkspace,
	disabled = false,
}: Props = $props();

// Convert workspaces to select items format
const workspaceItems = $derived(
	workspaces.map((workspace) => ({
		value: workspace.id,
		label: workspace.name,
		disabled: false,
	})),
);

const selectedValue = $derived(currentWorkspace?.id || "");
const selectedLabel = $derived(
	currentWorkspace?.name ||
		(workspaces.length === 0 ? "No workspaces" : "Select workspace"),
);

function handleValueChange(value: string | undefined) {
	if (value && onWorkspaceChange) {
		onWorkspaceChange(value);
	}
}

function handleCreateWorkspace() {
	onCreateWorkspace?.();
}
</script>

<div class="flex items-center gap-2">
	<Select.Root
		type="single"
		value={selectedValue}
		onValueChange={handleValueChange}
		items={workspaceItems}
		{disabled}
	>
		<Select.Trigger
			class="inline-flex h-9 items-center justify-between rounded-lg border border-subtle-base bg-surface-base px-3 py-2 text-sm font-medium text-foreground-base hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-w-[160px] max-w-[200px]"
			aria-label="Select workspace"
			disabled={disabled || workspaces.length === 0}
		>
			<span class="truncate">{selectedLabel}</span>
			<KeyboardArrowDown class="ml-2 h-4 w-4 text-foreground-secondary" />
		</Select.Trigger>

		<Select.Portal>
			<Select.Content
				class="z-50 min-w-[var(--bits-select-anchor-width)] overflow-hidden rounded-xl border border-subtle-base bg-surface-base shadow-lg"
				sideOffset={4}
				align="start"
			>
				<Select.Viewport class="p-1">
					{#each workspaceItems as workspace (workspace.value)}
						<Select.Item
							class="relative flex flex-col cursor-pointer select-none items-start rounded-lg px-3 py-2 text-sm outline-none hover:bg-surface-muted focus:bg-surface-muted data-[highlighted]:bg-surface-muted"
							value={workspace.value}
							label={workspace.label}
						>
							{#snippet children({ selected })}
								<div class="flex w-full items-center justify-between">
									<div class="flex-1 min-w-0">
										<div class="font-medium truncate">{workspace.label}</div>
										{#if workspaces.find(w => w.id === workspace.value)?.description}
											<div class="text-xs text-foreground-secondary truncate mt-0.5">
												{workspaces.find(w => w.id === workspace.value)?.description}
											</div>
										{/if}
									</div>
									{#if selected}
										<Check class="ml-2 h-4 w-4 text-primary flex-shrink-0" />
									{/if}
								</div>
							{/snippet}
						</Select.Item>
					{/each}

					{#if workspaceItems.length > 0}
						<div class="my-1 h-px bg-subtle-base"></div>
					{/if}

					<!-- Create New Workspace Option -->
					<button
						type="button"
						class="flex h-9 w-full items-center rounded-lg px-3 py-2 text-sm text-foreground-secondary hover:bg-surface-muted focus:bg-surface-muted focus:outline-none"
						onclick={handleCreateWorkspace}
					>
						<Plus class="mr-2 h-4 w-4" />
						<span>Create new workspace</span>
					</button>
				</Select.Viewport>
			</Select.Content>
		</Select.Portal>
	</Select.Root>
</div>