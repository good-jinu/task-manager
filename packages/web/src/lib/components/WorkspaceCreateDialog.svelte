<script lang="ts">
import { Dialog } from "bits-ui";
import { Close, Plus } from "./icons";

interface Props {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onCreateWorkspace?: (name: string, description?: string) => Promise<void>;
}

let {
	open = $bindable(false),
	onOpenChange,
	onCreateWorkspace,
}: Props = $props();

let workspaceName = $state("");
let workspaceDescription = $state("");
let isCreating = $state(false);
let error = $state("");

function handleOpenChange(newOpen: boolean) {
	open = newOpen;
	onOpenChange?.(newOpen);

	// Reset form when dialog closes
	if (!newOpen) {
		workspaceName = "";
		workspaceDescription = "";
		error = "";
		isCreating = false;
	}
}

async function handleSubmit(event: SubmitEvent) {
	event.preventDefault();

	if (!workspaceName.trim()) {
		error = "Workspace name is required";
		return;
	}

	if (workspaceName.trim().length < 2) {
		error = "Workspace name must be at least 2 characters";
		return;
	}

	isCreating = true;
	error = "";

	try {
		await onCreateWorkspace?.(
			workspaceName.trim(),
			workspaceDescription.trim() || undefined,
		);
		handleOpenChange(false);
	} catch (err) {
		error = err instanceof Error ? err.message : "Failed to create workspace";
	} finally {
		isCreating = false;
	}
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
		event.preventDefault();
		const fakeEvent = new Event("submit") as SubmitEvent;
		handleSubmit(fakeEvent);
	}
}
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
		<Dialog.Content
			class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-subtle-base bg-surface-base p-6 shadow-lg"
		>
			<div class="flex items-center justify-between mb-4">
				<Dialog.Title class="text-lg font-semibold text-foreground-base">
					Create New Workspace
				</Dialog.Title>
				<Dialog.Close
					class="rounded-lg p-2 text-foreground-secondary hover:bg-surface-muted hover:text-foreground-base focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
				>
					<Close class="h-4 w-4" />
				</Dialog.Close>
			</div>

			<Dialog.Description class="text-sm text-foreground-secondary mb-6">
				Create a new workspace to organize your tasks and projects.
			</Dialog.Description>

			<form onsubmit={(e) => handleSubmit(e)} class="space-y-4">
				<div>
					<label for="workspace-name" class="block text-sm font-medium text-foreground-base mb-2">
						Workspace Name *
					</label>
					<input
						id="workspace-name"
						type="text"
						bind:value={workspaceName}
						placeholder="e.g., Personal Tasks, Work Projects"
						class="w-full rounded-lg border border-subtle-base bg-surface-base px-3 py-2 text-sm text-foreground-base placeholder-foreground-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
						maxlength="50"
						required
						onkeydown={handleKeyDown}
					/>
				</div>

				<div>
					<label for="workspace-description" class="block text-sm font-medium text-foreground-base mb-2">
						Description (Optional)
					</label>
					<textarea
						id="workspace-description"
						bind:value={workspaceDescription}
						placeholder="Brief description of this workspace..."
						class="w-full rounded-lg border border-subtle-base bg-surface-base px-3 py-2 text-sm text-foreground-base placeholder-foreground-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 resize-none"
						rows="3"
						maxlength="200"
						onkeydown={handleKeyDown}
					></textarea>
				</div>

				{#if error}
					<div class="rounded-lg bg-error/10 border border-error/20 p-3">
						<p class="text-sm text-error">{error}</p>
					</div>
				{/if}

				<div class="flex justify-end gap-3 pt-2">
					<Dialog.Close
						class="rounded-lg border border-subtle-base bg-surface-base px-4 py-2 text-sm font-medium text-foreground-base hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
						disabled={isCreating}
					>
						Cancel
					</Dialog.Close>
					<button
						type="submit"
						class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={isCreating || !workspaceName.trim()}
					>
						{#if isCreating}
							<div class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
						{:else}
							<Plus class="h-4 w-4" />
						{/if}
						{isCreating ? "Creating..." : "Create Workspace"}
					</button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>