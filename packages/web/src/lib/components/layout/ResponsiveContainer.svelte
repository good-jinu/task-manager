<script lang="ts">
import type { Session } from "@auth/sveltekit";
import type { Snippet } from "svelte";
import { onMount } from "svelte";
import { getGuestTaskCount, guestUser, isGuestMode } from "$lib/stores/guest";
import GuestBanner from "../GuestBanner.svelte";

let {
	children,
	session,
	showGuestBanner = true,
	class: className = "",
	currentPath = "/",
}: {
	children: Snippet;
	session: Session | null;
	showGuestBanner?: boolean;
	class?: string;
	currentPath?: string;
} = $props();

// Check if user is a guest (not authenticated)
let isGuest = $derived(!session);

// Don't show guest banner on landing page (main page for unauthenticated users)
let shouldShowGuestBanner = $derived(
	isGuest && showGuestBanner && currentPath !== "/" && $isGuestMode,
);

// Guest task count for banner
let guestTaskCount = $state(0);

onMount(async () => {
	if ($isGuestMode && !session) {
		try {
			guestTaskCount = await getGuestTaskCount();
		} catch (err) {
			console.error(
				"Failed to load guest task count in ResponsiveContainer:",
				err,
			);
		}
	}
});

// Update task count when guest user changes
$effect(() => {
	if ($guestUser?.taskCount !== undefined) {
		guestTaskCount = $guestUser.taskCount;
	}
});
</script>

<div class="min-h-screen bg-page-bg">
	<!-- Guest Banner - Only show for unauthenticated users on non-landing pages -->
	{#if shouldShowGuestBanner}
		<GuestBanner 
			taskCount={guestTaskCount}
			daysRemaining={7}
			onSignUp={() => {
				// Navigate to main page and show dialog
				window.location.href = '/';
			}}
		/>
	{/if}

	<!-- Main Content Container -->
	<main class="flex-1 {className}">
		<div class="pt-4 pb-8 px-4 md:px-6 lg:px-8">
			<div class="max-w-7xl mx-auto">
				{@render children()}
			</div>
		</div>
	</main>
</div>