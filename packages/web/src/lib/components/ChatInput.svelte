<script lang="ts">
import { Send, Spinner } from "./icons";
import { Button } from "./ui";

interface Props {
	value: string;
	onSubmit: (message: string) => void;
	isLoading?: boolean;
	placeholder?: string;
}

let {
	value = $bindable(),
	onSubmit,
	isLoading = false,
	placeholder = "Type a message...",
}: Props = $props();

let textareaRef: HTMLTextAreaElement | null = $state(null);

function handleSubmit() {
	if (!value.trim() || isLoading) return;
	onSubmit(value.trim());
	value = "";
	adjustHeight();
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		handleSubmit();
	}
}

function adjustHeight() {
	if (textareaRef) {
		textareaRef.style.height = "auto";
		textareaRef.style.height = `${Math.min(textareaRef.scrollHeight, 120)}px`;
	}
}

$effect(() => {
	adjustHeight();
});
</script>

<div class="border-t bg-card p-4">
	<div class="flex gap-2 items-end">
		<div class="flex-1 relative">
			<textarea
				bind:this={textareaRef}
				bind:value
				onkeydown={handleKeyDown}
				oninput={adjustHeight}
				placeholder={placeholder}
				disabled={isLoading}
				class="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm 
					   placeholder:text-muted-foreground focus:outline-none focus:ring-2 
					   focus:ring-primary focus:ring-offset-2 disabled:opacity-50
					   min-h-[40px] max-h-[120px]"
				rows="1"
			></textarea>
		</div>
		
		<Button
			onclick={handleSubmit}
			disabled={!value.trim() || isLoading}
			size="sm"
			class="px-3 py-2 h-10"
		>
			{#if isLoading}
				<Spinner class="w-4 h-4" />
			{:else}
				<Send class="w-4 h-4" />
			{/if}
		</Button>
	</div>
</div>