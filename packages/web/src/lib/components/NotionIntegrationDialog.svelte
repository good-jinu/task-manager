<script lang="ts">
import type { ExternalIntegration } from "@notion-task-manager/db";
import { ArrowRightAlt, Check, Close, Database, Spinner } from "./icons";
import { Button, Card } from "./ui";
import { cn } from "./utils";

interface NotionDatabase {
	id: string;
	name: string;
	url?: string;
}

interface Props {
	isOpen: boolean;
	workspaceId: string;
	availableDatabases?: NotionDatabase[];
	loading?: boolean;
	onClose: () => void;
	onConnect: (databaseId: string, importExisting: boolean) => Promise<void>;
	class?: string;
}

let {
	isOpen,
	workspaceId,
	availableDatabases = [],
	loading = false,
	onClose,
	onConnect,
	class: className = "",
}: Props = $props();

let selectedDatabaseId = $state("");
let importExisting = $state(true);
let isConnecting = $state(false);
let step = $state<"select" | "connecting" | "success">("select");

// Reset state when dialog opens/closes
$effect(() => {
	if (isOpen) {
		step = "select";
		selectedDatabaseId = "";
		importExisting = true;
		isConnecting = false;
	}
});

async function handleConnect() {
	if (!selectedDatabaseId || isConnecting) return;

	isConnecting = true;
	step = "connecting";

	try {
		await onConnect(selectedDatabaseId, importExisting);
		step = "success";

		// Auto-close after success
		setTimeout(() => {
			onClose();
		}, 2000);
	} catch (error) {
		console.error("Connection failed:", error);
		step = "select";
		// Could show error message here
	} finally {
		isConnecting = false;
	}
}

function handleClose() {
	if (!isConnecting) {
		onClose();
	}
}

// Prevent background scroll when dialog is open
$effect(() => {
	if (typeof document === "undefined") return;

	if (isOpen) {
		document.body.style.overflow = "hidden";
	} else {
		document.body.style.overflow = "";
	}

	return () => {
		document.body.style.overflow = "";
	};
});

const selectedDatabase = $derived(
	availableDatabases.find((db) => db.id === selectedDatabaseId),
);
</script>

{#if isOpen}
	<!-- Backdrop -->
	<div 
		class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
		role="button"
		tabindex="0"
		onclick={handleClose}
		onkeydown={(e) => e.key === 'Enter' && handleClose()}
	>
		<!-- Dialog -->
		<Card
			variant="elevated"
			padding="lg"
			class={cn(
				'w-full max-w-lg mx-auto max-h-[90vh] overflow-y-auto',
				'animate-in fade-in-0 zoom-in-95 duration-200',
				className
			)}
			onclick={(e) => e.stopPropagation()}
		>
			{#if step === 'select'}
				<!-- Header -->
				<div class="flex items-center justify-between mb-6">
					<div class="flex items-center gap-2">
						<Database class="w-6 h-6 text-blue-600" />
						<h2 class="text-xl font-semibold text-gray-900">
							Connect Notion Database
						</h2>
					</div>
					<button
						onclick={handleClose}
						class={cn(
							'p-2 rounded-md text-gray-400 hover:text-gray-600',
							'hover:bg-gray-100 transition-colors',
							'min-w-[44px] min-h-[44px] flex items-center justify-center'
						)}
						aria-label="Close dialog"
					>
						<Close class="w-5 h-5" />
					</button>
				</div>

				<!-- Content -->
				<div class="space-y-6">
					<!-- Database selection -->
					<div>
						<label for="database-select" class="block text-sm font-medium text-gray-900 mb-3">
							Select a Notion database to sync with this workspace
						</label>
						
						{#if loading}
							<div class="flex items-center justify-center py-8">
								<Spinner class="w-6 h-6 text-blue-600" />
								<span class="ml-2 text-sm text-gray-600">Loading your databases...</span>
							</div>
						{:else if availableDatabases.length === 0}
							<div class="text-center py-8">
								<Database class="w-12 h-12 text-gray-300 mx-auto mb-3" />
								<p class="text-sm text-gray-600 mb-2">No databases found</p>
								<p class="text-xs text-gray-500">
									Make sure you have databases in your Notion workspace and have granted access to this app.
								</p>
							</div>
						{:else}
							<div class="space-y-2">
								{#each availableDatabases as database}
									<label
										class={cn(
											'flex items-center p-3 border rounded-lg cursor-pointer transition-colors',
											'hover:bg-gray-50',
											selectedDatabaseId === database.id
												? 'border-blue-500 bg-blue-50'
												: 'border-gray-200'
										)}
									>
										<input
											type="radio"
											bind:group={selectedDatabaseId}
											value={database.id}
											class="sr-only"
										/>
										<div class="flex items-center gap-3 flex-1">
											<Database class={cn(
												'w-5 h-5',
												selectedDatabaseId === database.id ? 'text-blue-600' : 'text-gray-400'
											)} />
											<div class="flex-1 min-w-0">
												<p class="font-medium text-gray-900 truncate">
													{database.name}
												</p>
												{#if database.url}
													<p class="text-xs text-gray-500 truncate">
														{database.url}
													</p>
												{/if}
											</div>
										</div>
										{#if selectedDatabaseId === database.id}
											<Check class="w-5 h-5 text-blue-600" />
										{/if}
									</label>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Import option -->
					{#if selectedDatabase}
						<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
							<div class="flex items-start gap-3">
								<input
									id="import-existing"
									type="checkbox"
									bind:checked={importExisting}
									class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
								/>
								<div>
									<label for="import-existing" class="text-sm font-medium text-blue-900 cursor-pointer">
										Import existing tasks from this database
									</label>
									<p class="text-xs text-blue-700 mt-1">
										This will create internal copies of all tasks currently in the selected Notion database.
									</p>
								</div>
							</div>
						</div>
					{/if}

					<!-- Actions -->
					<div class="flex flex-col sm:flex-row gap-3">
						<Button
							onclick={handleConnect}
							variant="primary"
							class="flex-1"
							disabled={!selectedDatabaseId || isConnecting || loading}
						>
							<span class="flex items-center justify-center gap-2">
								Connect Database
								<ArrowRightAlt class="w-4 h-4" />
							</span>
						</Button>
						<Button
							onclick={handleClose}
							variant="outline"
							disabled={isConnecting}
						>
							Cancel
						</Button>
					</div>
				</div>

			{:else if step === 'connecting'}
				<!-- Connecting state -->
				<div class="text-center py-8">
					<Spinner class="w-8 h-8 mx-auto mb-4 text-blue-600" />
					<h3 class="text-lg font-medium text-gray-900 mb-2">
						Connecting to Notion
					</h3>
					<p class="text-sm text-gray-600">
						{#if importExisting}
							Setting up sync and importing existing tasks...
						{:else}
							Setting up sync with {selectedDatabase?.name}...
						{/if}
					</p>
				</div>

			{:else if step === 'success'}
				<!-- Success state -->
				<div class="text-center py-8">
					<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
						<Check class="w-8 h-8 text-green-600" />
					</div>
					<h3 class="text-lg font-medium text-gray-900 mb-2">
						Connected Successfully!
					</h3>
					<p class="text-sm text-gray-600">
						Your workspace is now synced with {selectedDatabase?.name}.
						{#if importExisting}
							Existing tasks are being imported.
						{/if}
					</p>
				</div>
			{/if}
		</Card>
	</div>
{/if}

<style>
	@keyframes animate-in {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.animate-in {
		animation: animate-in 0.2s ease-out;
	}
</style>