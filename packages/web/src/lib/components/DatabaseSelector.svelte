<script lang="ts">
import { Select } from "bits-ui";
import { Check, Database, KeyboardArrowDown, Spinner } from "./icons";

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

interface Props {
	databases: NotionDatabase[];
	currentDatabase: NotionDatabase | null;
	onDatabaseChange?: (databaseId: string) => void;
	onSetupNotion?: () => void;
	disabled?: boolean;
	loading?: boolean;
}

let {
	databases = [],
	currentDatabase = null,
	onDatabaseChange,
	onSetupNotion,
	disabled = false,
	loading = false,
}: Props = $props();

// Convert databases to select items format
const databaseItems = $derived(
	databases.map((database) => ({
		value: database.id,
		label: database.title,
		disabled: false,
	})),
);

const selectedValue = $derived(currentDatabase?.id || "");
const selectedLabel = $derived(currentDatabase?.title || "Select Database");

const hasNoDatabases = $derived(databases.length === 0 && !loading);
const showSelector = $derived(databases.length > 0 || loading);

function handleValueChange(value: string | undefined) {
	if (value && onDatabaseChange) {
		onDatabaseChange(value);
	}
}

function handleSetupNotion() {
	onSetupNotion?.();
}

// Get database icon
function getDatabaseIcon(database: NotionDatabase) {
	if (database.icon?.type === "emoji" && database.icon.emoji) {
		return database.icon.emoji;
	}
	return null;
}
</script>

<div class="flex items-center gap-2">
	{#if showSelector}
		<!-- Database selector when databases are available or loading -->
		<Select.Root
			type="single"
			value={selectedValue}
			onValueChange={handleValueChange}
			items={databaseItems}
			disabled={disabled || loading}
		>
			<Select.Trigger
				class="inline-flex h-9 items-center justify-between rounded-lg border border-subtle-base bg-surface-base px-3 py-2 text-sm font-medium text-foreground-base hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full"
				aria-label="Select database"
			>
				<div class="flex items-center min-w-0 flex-1">
					{#if loading}
						<Spinner class="mr-2 h-4 w-4 text-foreground-secondary flex-shrink-0" />
					{:else if currentDatabase}
						{@const icon = getDatabaseIcon(currentDatabase)}
						{#if icon}
							<span class="mr-2 text-sm">{icon}</span>
						{:else}
							<Database class="mr-2 h-4 w-4 text-foreground-secondary flex-shrink-0" />
						{/if}
					{:else}
						<Database class="mr-2 h-4 w-4 text-foreground-secondary flex-shrink-0" />
					{/if}
					<span class="truncate">{loading ? "Loading..." : selectedLabel}</span>
				</div>
				<KeyboardArrowDown class="ml-2 h-4 w-4 text-foreground-secondary flex-shrink-0" />
			</Select.Trigger>

			<Select.Portal>
				<Select.Content
					class="z-50 min-w-[var(--bits-select-anchor-width)] overflow-hidden rounded-xl border border-subtle-base bg-surface-base shadow-lg"
					sideOffset={4}
					align="start"
				>
					<Select.Viewport class="p-1">
						{#if loading}
							<div class="flex items-center justify-center py-4">
								<Spinner class="h-4 w-4 text-foreground-secondary" />
								<span class="ml-2 text-sm text-foreground-secondary">Loading databases...</span>
							</div>
						{:else}
							{#each databaseItems as database (database.value)}
								{@const dbData = databases.find(d => d.id === database.value)}
								<Select.Item
									class="relative flex flex-col cursor-pointer select-none items-start rounded-lg px-3 py-2 text-sm outline-none hover:bg-surface-muted focus:bg-surface-muted data-[highlighted]:bg-surface-muted"
									value={database.value}
									label={database.label}
								>
									{#snippet children({ selected })}
										<div class="flex w-full items-center justify-between">
											<div class="flex items-center min-w-0 flex-1">
												{#if dbData}
													{@const icon = getDatabaseIcon(dbData)}
													{#if icon}
														<span class="mr-2 text-sm flex-shrink-0">{icon}</span>
													{:else}
														<Database class="mr-2 h-4 w-4 text-foreground-secondary flex-shrink-0" />
													{/if}
												{:else}
													<Database class="mr-2 h-4 w-4 text-foreground-secondary flex-shrink-0" />
												{/if}
												<div class="min-w-0 flex-1">
													<div class="font-medium truncate">{database.label}</div>
												</div>
											</div>
											{#if selected}
												<Check class="ml-2 h-4 w-4 text-primary flex-shrink-0" />
											{/if}
										</div>
									{/snippet}
								</Select.Item>
							{/each}

							{#if databaseItems.length > 0}
								<div class="my-1 h-px bg-subtle-base"></div>
							{/if}

							<!-- Setup/Reconnect Notion Option -->
							<button
								type="button"
								class="flex h-9 w-full items-center rounded-lg px-3 py-2 text-sm text-foreground-secondary hover:bg-surface-muted focus:bg-surface-muted focus:outline-none"
								onclick={handleSetupNotion}
							>
								<Database class="mr-2 h-4 w-4" />
								<span>Reconnect Notion</span>
							</button>
						{/if}
					</Select.Viewport>
				</Select.Content>
			</Select.Portal>
		</Select.Root>
	{:else}
		<!-- Setup Notion button when no databases available -->
		<button
			type="button"
			class="inline-flex h-9 items-center justify-center rounded-lg border border-subtle-base bg-surface-base px-3 py-2 text-sm font-medium text-foreground-base hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full"
			onclick={handleSetupNotion}
			{disabled}
			aria-label="Setup Notion integration"
		>
			<Database class="mr-2 h-4 w-4 text-foreground-secondary" />
			<span>Setup Notion</span>
		</button>
	{/if}
</div>