<script lang="ts">
import type { Task } from "@notion-task-manager/db";
import { Dialog } from "bits-ui";
import { ArrowRightAlt, Check, Close, Spinner } from "./icons";
import { Button } from "./ui";

interface Props {
	open: boolean;
	guestTasks?: Task[];
	onOpenChange: (open: boolean) => void;
	onCreateAccount: (migrateData: boolean) => Promise<void>;
}

let {
	open = $bindable(),
	guestTasks = [],
	onOpenChange,
	onCreateAccount,
}: Props = $props();

let migrateData = $state(true);
let isCreating = $state(false);
let step = $state<"confirm" | "creating" | "success">("confirm");

// Reset state when dialog opens/closes
$effect(() => {
	if (open) {
		step = "confirm";
		migrateData = true;
		isCreating = false;
	}
});

async function handleCreateAccount() {
	if (isCreating) return;

	isCreating = true;
	step = "creating";

	try {
		await onCreateAccount(migrateData);
		step = "success";

		// Auto-close after success
		setTimeout(() => {
			onOpenChange(false);
		}, 2000);
	} catch (error) {
		console.error("Account creation failed:", error);
		step = "confirm";
		// Could show error message here
	} finally {
		isCreating = false;
	}
}

function handleClose() {
	if (!isCreating) {
		onOpenChange(false);
	}
}
</script>

<Dialog.Root bind:open onOpenChange={onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 bg-black/50 z-50" />
		<Dialog.Content class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg border shadow-lg p-6">
			{#if step === 'confirm'}
				<!-- Header -->
				<div class="flex items-center justify-between mb-6">
					<Dialog.Title class="text-xl font-semibold text-gray-900">
						Create Your Account
					</Dialog.Title>
					<Dialog.Close class="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Close dialog">
						<Close class="w-5 h-5" />
					</Dialog.Close>
				</div>

				<!-- Content -->
				<div class="space-y-6">
					<!-- Benefits -->
					<div>
						<h3 class="text-sm font-medium text-gray-900 mb-3">
							Account Benefits
						</h3>
						<ul class="space-y-2 text-sm text-gray-600">
							<li class="flex items-center gap-2">
								<Check class="w-4 h-4 text-green-500 flex-shrink-0" />
								<span>Keep your tasks permanently</span>
							</li>
							<li class="flex items-center gap-2">
								<Check class="w-4 h-4 text-green-500 flex-shrink-0" />
								<span>Sync with Notion databases</span>
							</li>
							<li class="flex items-center gap-2">
								<Check class="w-4 h-4 text-green-500 flex-shrink-0" />
								<span>Access from multiple devices</span>
							</li>
							<li class="flex items-center gap-2">
								<Check class="w-4 h-4 text-green-500 flex-shrink-0" />
								<span>Advanced AI features</span>
							</li>
						</ul>
					</div>

					<!-- Migration option -->
					{#if guestTasks.length > 0}
						<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
							<div class="flex items-start gap-3">
								<input
									id="migrate-data"
									type="checkbox"
									bind:checked={migrateData}
									class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
								/>
								<div>
									<label for="migrate-data" class="text-sm font-medium text-blue-900 cursor-pointer">
										Transfer your {guestTasks.length} task{guestTasks.length === 1 ? '' : 's'}
									</label>
									<p class="text-xs text-blue-700 mt-1">
										Your current tasks will be moved to your new account
									</p>
								</div>
							</div>
						</div>
					{/if}

					<!-- Actions -->
					<div class="flex flex-col sm:flex-row gap-3">
						<Button
							onclick={handleCreateAccount}
							variant="primary"
							class="flex-1"
							disabled={isCreating}
						>
							<span class="flex items-center justify-center gap-2">
								Create Account
								<ArrowRightAlt class="w-4 h-4" />
							</span>
						</Button>
						<Dialog.Close>
							<Button
								variant="outline"
								disabled={isCreating}
							>
								Cancel
							</Button>
						</Dialog.Close>
					</div>
				</div>

			{:else if step === 'creating'}
				<!-- Creating state -->
				<div class="text-center py-8">
					<Spinner class="w-8 h-8 mx-auto mb-4 text-blue-600" />
					<Dialog.Title class="text-lg font-medium text-gray-900 mb-2">
						Creating Your Account
					</Dialog.Title>
					<Dialog.Description class="text-sm text-gray-600">
						{#if migrateData && guestTasks.length > 0}
							Transferring your {guestTasks.length} task{guestTasks.length === 1 ? '' : 's'}...
						{:else}
							Setting up your workspace...
						{/if}
					</Dialog.Description>
				</div>

			{:else if step === 'success'}
				<!-- Success state -->
				<div class="text-center py-8">
					<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
						<Check class="w-8 h-8 text-green-600" />
					</div>
					<Dialog.Title class="text-lg font-medium text-gray-900 mb-2">
						Account Created!
					</Dialog.Title>
					<Dialog.Description class="text-sm text-gray-600">
						{#if migrateData && guestTasks.length > 0}
							Your {guestTasks.length} task{guestTasks.length === 1 ? ' has' : 's have'} been transferred successfully.
						{:else}
							Welcome to your new task management workspace!
						{/if}
					</Dialog.Description>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

