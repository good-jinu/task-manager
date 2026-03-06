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
		'relative overflow-hidden rounded-2xl p-6 transition-all duration-300',
		'bg-surface-base/40 backdrop-blur-xl border border-white/20 shadow-xl',
		urgencyStyles.bg, urgencyStyles.border,
		className
	)}>
		<!-- Decorative background elements -->
		<div class="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
		<div class="absolute -bottom-24 -left-24 w-48 h-48 bg-accent/10 rounded-full blur-3xl pointer-events-none"></div>

		<div class="relative flex items-start gap-5">
			<div class={cn(
				"flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-inner",
				urgencyStyles.bg, "brightness-95"
			)}>
				<Info class={cn("w-6 h-6", urgencyStyles.icon)} />
			</div>
			
			<div class="flex-1 min-w-0">
				<div class="flex items-start justify-between gap-4">
					<div class="flex-1">
						<h3 class="text-lg font-bold text-foreground-base tracking-tight mb-1">
							{#if urgencyLevel === 'critical'}
								⚠️ Your tasks are expiring tomorrow!
							{:else if urgencyLevel === 'high'}
								Tasks will be deleted in {daysRemaining} days
							{:else}
								Welcome to your Guest Workspace
							{/if}
						</h3>
						
						<div class="text-sm text-foreground-secondary leading-relaxed max-w-2xl">
							{#if taskCount > 0}
								<p>
									You've created <span class={cn("font-bold px-1.5 py-0.5 rounded-md bg-white/50", urgencyStyles.accent)}>{taskCount}</span>
									task{taskCount === 1 ? '' : 's'}. Don't let your hard work vanish!
									Create an account now to preserve your progress indefinitely.
								</p>
							{:else}
								<p>
									Tasks created in guest mode are stored locally and will be automatically cleared after 7 days of inactivity.
								</p>
							{/if}

							{#if showIntegrationBenefits}
								<div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div class="flex items-center gap-2 p-2 rounded-lg bg-white/30 border border-white/40">
										<div class="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
											<CheckCircle class="w-3.5 h-3.5 text-success" />
										</div>
										<span class="text-xs font-medium">Full Notion Sync</span>
									</div>
									<div class="flex items-center gap-2 p-2 rounded-lg bg-white/30 border border-white/40">
										<div class="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
											<CheckCircle class="w-3.5 h-3.5 text-success" />
										</div>
										<span class="text-xs font-medium">Multi-device Access</span>
									</div>
								</div>
							{/if}
						</div>
					</div>
					
					{#if onDismiss}
						<button
							onclick={handleDismiss}
							class="flex-shrink-0 p-2 rounded-full text-muted-foreground hover:text-foreground-base hover:bg-white/40 transition-all duration-200 active:scale-95"
							aria-label="Dismiss banner"
						>
							<Close class="w-5 h-5" />
						</button>
					{/if}
				</div>
				
				<div class="mt-6 flex flex-wrap items-center gap-3">
					{#if onSignUp}
						<Button
							onclick={handleSignUp}
							class={cn(
								"px-6 py-2.5 rounded-xl font-bold transition-all duration-200 shadow-lg active:scale-95",
								"bg-primary text-primary-foreground hover:shadow-primary/25",
								urgencyLevel === 'critical' && "bg-error hover:bg-error/90 text-white hover:shadow-error/25",
								urgencyLevel === 'high' && "bg-warning hover:bg-warning/90 text-white hover:shadow-warning/25"
							)}
						>
							{#if urgencyLevel === 'critical'}
								Save My Tasks Now
							{:else if urgencyLevel === 'high'}
								Secure My Progress
							{:else}
								Create Free Account
							{/if}
						</Button>
					{/if}
					
					<button
						onclick={handleDismiss}
						class="px-5 py-2.5 rounded-xl text-sm font-semibold text-foreground-secondary hover:text-foreground-base hover:bg-white/40 transition-all duration-200"
					>
						{urgencyLevel === 'critical' ? 'Remind Me Later' : 'Keep as Guest'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}