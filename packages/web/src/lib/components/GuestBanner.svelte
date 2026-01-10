<script lang="ts">
import { Close, Info } from "./icons";
import { Button } from "./ui";
import { cn } from "./utils";

interface Props {
	taskCount?: number;
	daysRemaining?: number;
	onSignUp?: () => void;
	onDismiss?: () => void;
	class?: string;
}

let {
	taskCount = 0,
	daysRemaining = 7,
	onSignUp,
	onDismiss,
	class: className = "",
}: Props = $props();

let isDismissed = $state(false);

function handleDismiss() {
	isDismissed = true;
	onDismiss?.();
}

function handleSignUp() {
	onSignUp?.();
}
</script>

{#if !isDismissed}
	<div class={cn(
		'bg-info-alert-bg border border-info-border rounded-lg p-4',
		'shadow-sm',
		className
	)}>
		<div class="flex items-start gap-3">
			<div class="flex-shrink-0 mt-0.5">
				<Info class="w-5 h-5 text-info" />
			</div>
			
			<div class="flex-1 min-w-0">
				<div class="flex items-start justify-between gap-2">
					<div>
						<h3 class="text-sm font-medium text-foreground-emphasis mb-1">
							You're using a guest account
						</h3>
						<p class="text-sm text-foreground-secondary leading-relaxed">
							{#if taskCount > 0}
								You have {taskCount} task{taskCount === 1 ? '' : 's'} that will be deleted in {daysRemaining} day{daysRemaining === 1 ? '' : 's'}.
							{:else}
								Your tasks will be automatically deleted after 7 days.
							{/if}
							Create an account to keep your tasks permanently and sync with Notion.
						</p>
					</div>
					
					{#if onDismiss}
						<button
							onclick={handleDismiss}
							class={cn(
								'flex-shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground-base',
								'hover:bg-surface-muted transition-colors',
								'min-w-[44px] min-h-[44px] flex items-center justify-center'
							)}
							aria-label="Dismiss banner"
						>
							<Close class="w-4 h-4" />
						</button>
					{/if}
				</div>
				
				<div class="mt-3 flex flex-col sm:flex-row gap-2">
					{#if onSignUp}
						<Button
							onclick={handleSignUp}
							variant="primary"
							size="sm"
							class="bg-primary hover:bg-primary-button-hover text-primary-foreground"
						>
							Create Account
						</Button>
					{/if}
					
					<Button
						onclick={handleDismiss}
						variant="outline"
						size="sm"
						class="border-subtle-base text-foreground-secondary hover:bg-surface-muted"
					>
						Maybe Later
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}