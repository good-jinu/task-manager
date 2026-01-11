<script lang="ts">
import { browser } from "$app/environment";
import { CheckCircle, Close, Database, Info, RefreshRounded } from "./icons";
import { Button } from "./ui";
import { cn } from "./utils";

interface Props {
	taskCount?: number;
	daysRemaining?: number;
	onSignUp?: () => void;
	onDismiss?: () => void;
	showIntegrationBenefits?: boolean;
	class?: string;
}

let {
	taskCount = 0,
	daysRemaining = 7,
	onSignUp,
	onDismiss,
	showIntegrationBenefits = false,
	class: className = "",
}: Props = $props();

// Session persistence for dismissal state
const DISMISSAL_KEY = "guest_banner_dismissed";
const DISMISSAL_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

let isDismissed = $state(false);

// Check if banner was previously dismissed (with expiry)
$effect(() => {
	if (browser) {
		const dismissedData = localStorage.getItem(DISMISSAL_KEY);
		if (dismissedData) {
			try {
				const { timestamp } = JSON.parse(dismissedData);
				const now = Date.now();
				if (now - timestamp < DISMISSAL_EXPIRY) {
					isDismissed = true;
				} else {
					// Expired, remove from storage
					localStorage.removeItem(DISMISSAL_KEY);
				}
			} catch {
				// Invalid data, remove it
				localStorage.removeItem(DISMISSAL_KEY);
			}
		}
	}
});

function handleDismiss() {
	isDismissed = true;

	// Persist dismissal state with timestamp
	if (browser) {
		localStorage.setItem(
			DISMISSAL_KEY,
			JSON.stringify({
				timestamp: Date.now(),
			}),
		);
	}

	onDismiss?.();
}

function handleSignUp() {
	onSignUp?.();
}

// Calculate urgency level based on days remaining and task count
const urgencyLevel = $derived.by(() => {
	if (daysRemaining <= 1) return "critical";
	if (daysRemaining <= 3) return "high";
	if (taskCount >= 10) return "medium";
	return "low";
});

// Get appropriate styling based on urgency
const urgencyStyles = $derived.by(() => {
	switch (urgencyLevel) {
		case "critical":
			return {
				bg: "bg-error-alert-bg",
				border: "border-error-border",
				icon: "text-error",
				accent: "text-error",
			};
		case "high":
			return {
				bg: "bg-warning-alert-bg",
				border: "border-warning-border",
				icon: "text-warning",
				accent: "text-warning",
			};
		default:
			return {
				bg: "bg-info-alert-bg",
				border: "border-info-border",
				icon: "text-info",
				accent: "text-info",
			};
	}
});
</script>

{#if !isDismissed}
	<div class={cn(
		urgencyStyles.bg, 'border', urgencyStyles.border, 'rounded-lg p-4',
		'shadow-sm',
		className
	)}>
		<div class="flex items-start gap-3">
			<div class="flex-shrink-0 mt-0.5">
				<Info class={cn("w-5 h-5", urgencyStyles.icon)} />
			</div>
			
			<div class="flex-1 min-w-0">
				<div class="flex items-start justify-between gap-2">
					<div class="flex-1">
						<h3 class="text-sm font-medium text-foreground-emphasis mb-1">
							{#if urgencyLevel === 'critical'}
								⚠️ Tasks expire tomorrow!
							{:else if urgencyLevel === 'high'}
								Tasks expire in {daysRemaining} days
							{:else}
								You're using a guest account
							{/if}
						</h3>
						
						<div class="text-sm text-foreground-secondary leading-relaxed space-y-2">
							<!-- Task count and expiration warning -->
							<p>
								{#if taskCount > 0}
									You have <span class={cn("font-medium", urgencyStyles.accent)}>{taskCount}</span> 
									task{taskCount === 1 ? '' : 's'} that will be deleted in 
									<span class={cn("font-medium", urgencyStyles.accent)}>{daysRemaining}</span> 
									day{daysRemaining === 1 ? '' : 's'}.
								{:else}
									Your tasks will be automatically deleted after 7 days.
								{/if}
							</p>
							
							<!-- Integration benefits section -->
							{#if showIntegrationBenefits}
								<div class="mt-3 p-3 bg-surface-base/50 rounded-lg border border-subtle-base">
									<h4 class="text-sm font-medium text-foreground-base mb-2 flex items-center gap-2">
										<RefreshRounded class="w-4 h-4 text-primary" />
										Unlock Notion Integration
									</h4>
									<ul class="space-y-1.5 text-xs text-foreground-secondary">
										<li class="flex items-center gap-2">
											<CheckCircle class="w-3 h-3 text-success flex-shrink-0" />
											<span>Sync tasks with your Notion databases</span>
										</li>
										<li class="flex items-center gap-2">
											<CheckCircle class="w-3 h-3 text-success flex-shrink-0" />
											<span>Access tasks from anywhere</span>
										</li>
										<li class="flex items-center gap-2">
											<CheckCircle class="w-3 h-3 text-success flex-shrink-0" />
											<span>Collaborate with your team</span>
										</li>
										<li class="flex items-center gap-2">
											<CheckCircle class="w-3 h-3 text-success flex-shrink-0" />
											<span>Never lose your tasks again</span>
										</li>
									</ul>
								</div>
							{:else}
								<p>
									Create an account to keep your tasks permanently and 
									<span class="font-medium text-primary">sync with Notion</span>.
								</p>
							{/if}
						</div>
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
				
				<div class="mt-4 flex flex-col sm:flex-row gap-2">
					{#if onSignUp}
						<Button
							onclick={handleSignUp}
							variant="primary"
							size="sm"
							class={cn(
								"bg-primary hover:bg-primary-button-hover text-primary-foreground",
								"min-h-[44px] font-medium",
								urgencyLevel === 'critical' && "bg-error hover:bg-error/90 text-white",
								urgencyLevel === 'high' && "bg-warning hover:bg-warning/90 text-white"
							)}
						>
							{#if urgencyLevel === 'critical'}
								Save My Tasks Now
							{:else if urgencyLevel === 'high'}
								Create Account & Save Tasks
							{:else}
								Create Free Account
							{/if}
						</Button>
					{/if}
					
					<Button
						onclick={handleDismiss}
						variant="outline"
						size="sm"
						class="border-subtle-base text-foreground-secondary hover:bg-surface-muted min-h-[44px]"
					>
						{urgencyLevel === 'critical' ? 'Remind Me Later' : 'Maybe Later'}
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}