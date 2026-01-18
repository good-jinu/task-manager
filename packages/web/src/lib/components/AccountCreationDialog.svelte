<script lang="ts">
import type { Task } from "@task-manager/db";
import { Dialog } from "bits-ui";
import { Check, Close, NotionLogo, Spinner } from "./icons";
import { Button } from "./ui";

interface Props {
	open: boolean;
	guestTasks?: Task[];
	onOpenChange: (open: boolean) => void;
	onNotionLogin: (migrateData: boolean) => Promise<void>;
}

let {
	open = $bindable(),
	guestTasks = [],
	onOpenChange,
	onNotionLogin,
}: Props = $props();

let migrateData = $state(true);
let isLoggingIn = $state(false);
let step = $state<"confirm" | "logging-in" | "success" | "error">("confirm");
let errorMessage = $state("");

// Reset state when dialog opens/closes
$effect(() => {
	if (open) {
		step = "confirm";
		migrateData = true;
		isLoggingIn = false;
		errorMessage = "";
	}
});

async function handleNotionLogin() {
	if (isLoggingIn) return;

	isLoggingIn = true;
	step = "logging-in";

	try {
		await onNotionLogin(migrateData);
		step = "success";

		// Auto-close after success
		setTimeout(() => {
			onOpenChange(false);
		}, 2000);
	} catch (error) {
		console.error("Notion login failed:", error);
		step = "error";
		errorMessage =
			error instanceof Error
				? error.message
				: "Failed to connect to Notion. Please try again.";
	} finally {
		isLoggingIn = false;
	}
}

function handleClose() {
	if (!isLoggingIn) {
		onOpenChange(false);
	}
}
</script>

<Dialog.Root bind:open onOpenChange={onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 bg-black/50 z-50" />
		<Dialog.Content class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 bg-surface-base border-subtle-base rounded-lg border shadow-lg p-6">
			{#if step === 'confirm'}
				<!-- Header -->
				<div class="flex items-center justify-between mb-6">
					<Dialog.Title class="text-xl font-semibold text-foreground-base">
						Connect Your Account
					</Dialog.Title>
					<Dialog.Close class="p-2 rounded-md text-foreground-secondary hover:text-foreground-base hover:bg-surface-raised transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Close dialog">
						<Close class="w-5 h-5" />
					</Dialog.Close>
				</div>

				<!-- Content -->
				<div class="space-y-6">
					<!-- Benefits -->
					<div>
						<h3 class="text-sm font-medium text-foreground-base mb-3">
							Account Benefits
						</h3>
						<ul class="space-y-2 text-sm text-foreground-secondary">
							<li class="flex items-center gap-2">
								<Check class="w-4 h-4 text-success flex-shrink-0" />
								<span>Keep your tasks permanently</span>
							</li>
							<li class="flex items-center gap-2">
								<Check class="w-4 h-4 text-success flex-shrink-0" />
								<span>Sync with Notion databases</span>
							</li>
							<li class="flex items-center gap-2">
								<Check class="w-4 h-4 text-success flex-shrink-0" />
								<span>Access from multiple devices</span>
							</li>
							<li class="flex items-center gap-2">
								<Check class="w-4 h-4 text-success flex-shrink-0" />
								<span>Advanced AI features</span>
							</li>
						</ul>
					</div>

					<!-- Migration option -->
					{#if guestTasks.length > 0}
						<div class="bg-info-alert-bg border border-info-border rounded-lg p-4">
							<div class="flex items-start gap-3">
								<input
									id="migrate-data"
									type="checkbox"
									bind:checked={migrateData}
									class="mt-1 w-4 h-4 text-info border-subtle-base rounded focus:ring-info focus:ring-2"
								/>
								<div>
									<label for="migrate-data" class="text-sm font-medium text-info-foreground cursor-pointer">
										Transfer your {guestTasks.length} task{guestTasks.length === 1 ? '' : 's'}
									</label>
									<p class="text-xs text-info-foreground/80 mt-1">
										Your current tasks will be moved to your new account
									</p>
								</div>
							</div>
						</div>
					{/if}

					<!-- Actions -->
					<div class="flex flex-col gap-3">
						<Button
							onclick={handleNotionLogin}
							variant="primary"
							class="w-full flex items-center justify-center gap-3 py-3"
							disabled={isLoggingIn}
						>
							<NotionLogo class="w-5 h-5" />
							<span>Continue with Notion</span>
						</Button>
						<Dialog.Close>
							<Button
								variant="outline"
								class="w-full"
								disabled={isLoggingIn}
							>
								Cancel
							</Button>
						</Dialog.Close>
					</div>
				</div>

			{:else if step === 'logging-in'}
				<!-- Logging in state -->
				<div class="text-center py-8">
					<Spinner class="w-8 h-8 mx-auto mb-4 text-primary" />
					<Dialog.Title class="text-lg font-medium text-foreground-base mb-2">
						Connecting to Notion
					</Dialog.Title>
					<Dialog.Description class="text-sm text-foreground-secondary">
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
					<div class="w-16 h-16 bg-success-alert-bg rounded-full flex items-center justify-center mx-auto mb-4">
						<Check class="w-8 h-8 text-success" />
					</div>
					<Dialog.Title class="text-lg font-medium text-foreground-base mb-2">
						Connected Successfully!
					</Dialog.Title>
					<Dialog.Description class="text-sm text-foreground-secondary">
						{#if migrateData && guestTasks.length > 0}
							Your {guestTasks.length} task{guestTasks.length === 1 ? ' has' : 's have'} been transferred successfully.
						{:else}
							Welcome to your connected task management workspace!
						{/if}
					</Dialog.Description>
				</div>

			{:else if step === 'error'}
				<!-- Error state -->
				<div class="text-center py-8">
					<div class="w-16 h-16 bg-error-alert-bg rounded-full flex items-center justify-center mx-auto mb-4">
						<Close class="w-8 h-8 text-error" />
					</div>
					<Dialog.Title class="text-lg font-medium text-foreground-base mb-2">
						Connection Failed
					</Dialog.Title>
					<Dialog.Description class="text-sm text-foreground-secondary mb-6">
						{errorMessage}
					</Dialog.Description>
					<div class="flex flex-col gap-3">
						<Button
							onclick={() => { step = "confirm"; errorMessage = ""; }}
							variant="primary"
							class="w-full"
						>
							Try Again
						</Button>
						<Dialog.Close>
							<Button
								variant="outline"
								class="w-full"
							>
								Cancel
							</Button>
						</Dialog.Close>
					</div>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>