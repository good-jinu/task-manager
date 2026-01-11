<script lang="ts">
import type { Workspace } from "@notion-task-manager/db";
import { DropdownMenu } from "bits-ui";
import { Home, Menu, NotionLogo, Settings, User } from "./icons";
import WorkspaceSelector from "./WorkspaceSelector.svelte";

interface Props {
	onMenuAction?: (action: string) => void;
	onWorkspaceChange?: (workspaceId: string) => void;
	onCreateWorkspace?: () => void;
	isAuthenticated?: boolean;
	isGuestMode?: boolean;
	workspaces?: Workspace[];
	currentWorkspace?: Workspace | null;
}

let {
	onMenuAction,
	onWorkspaceChange,
	onCreateWorkspace,
	isAuthenticated = false,
	isGuestMode = false,
	workspaces = [],
	currentWorkspace = null,
}: Props = $props();

// Menu state management
let isMenuOpen = $state(false);

function handleMenuItemClick(action: string) {
	onMenuAction?.(action);
	// Close menu after action
	isMenuOpen = false;
}

function handleMenuOpenChange(open: boolean) {
	isMenuOpen = open;
}

// Handle keyboard navigation
function handleKeyDown(event: KeyboardEvent) {
	if (event.key === "Escape" && isMenuOpen) {
		isMenuOpen = false;
	}
}
</script>

<!-- Sticky Top Menu -->
<div class="sticky top-0 z-50 bg-surface-base border-b border-subtle-base">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between h-14">
			<div class="flex items-center gap-4">
				<h1 class="text-lg font-semibold text-foreground-base">TaskFlow</h1>
				
				<!-- Workspace Selector - Only show for authenticated users with multiple workspaces or ability to create -->
				{#if isAuthenticated && !isGuestMode}
					<WorkspaceSelector
						{workspaces}
						{currentWorkspace}
						{onWorkspaceChange}
						{onCreateWorkspace}
					/>
				{/if}
			</div>
			
			<!-- Dropdown Menu -->
			<DropdownMenu.Root bind:open={isMenuOpen} onOpenChange={handleMenuOpenChange}>
				<DropdownMenu.Trigger
					class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-subtle-base bg-surface-base hover:bg-surface-muted text-foreground-base transition-colors min-w-[44px] min-h-[44px] touch-manipulation"
					aria-label="Open menu"
				>
					<Menu class="h-5 w-5" />
				</DropdownMenu.Trigger>
				
				<DropdownMenu.Portal>
					<DropdownMenu.Content
						class="w-64 rounded-xl border border-subtle-base bg-surface-base shadow-lg px-1 py-1.5 z-50"
						sideOffset={8}
						align="end"
					>
						<!-- Home Option -->
						<DropdownMenu.Item
							class="flex h-10 items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-muted focus:bg-surface-muted focus:outline-none cursor-pointer min-h-[44px] touch-manipulation"
							onSelect={() => handleMenuItemClick('home')}
						>
							<div class="flex items-center gap-2">
								<Home class="h-4 w-4 text-foreground-secondary" />
								<span>Home</span>
							</div>
						</DropdownMenu.Item>

						<DropdownMenu.Separator class="my-1 h-px bg-subtle-base" />

						{#if isGuestMode && !isAuthenticated}
							<!-- Guest Mode Options -->
							<div class="px-3 py-2 border-b border-subtle-base mb-1">
								<div class="flex items-center gap-2 mb-1">
					 				<User class="h-4 w-4 text-accent" />
									<span class="text-sm font-medium text-accent">Guest Mode</span>
								</div>
								<p class="text-xs text-muted-foreground">Your tasks are saved locally</p>
								<p class="text-xs text-info mt-1">Create an account to unlock integrations</p>
							</div>
							
							<DropdownMenu.Item
								class="flex h-10 items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-muted focus:bg-surface-muted focus:outline-none cursor-pointer min-h-[44px] touch-manipulation"
								onSelect={() => handleMenuItemClick('signup')}
							>
								<div class="flex items-center gap-2">
									<User class="h-4 w-4 text-primary" />
									<span class="font-medium text-primary">Sign Up (Unlock Features)</span>
								</div>
							</DropdownMenu.Item>
						{/if}
						
						{#if isAuthenticated}
							<!-- Authenticated User Options -->
							<div class="px-3 py-2 border-b border-subtle-base mb-1">
								<div class="flex items-center gap-2 mb-1">
									<User class="h-4 w-4 text-primary" />
									<span class="text-sm font-medium text-primary">Signed In</span>
								</div>
								<p class="text-xs text-muted-foreground">Sync across devices available</p>
							</div>
							
							<DropdownMenu.Item
								class="flex h-10 items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-muted focus:bg-surface-muted focus:outline-none cursor-pointer min-h-[44px] touch-manipulation"
								onSelect={() => handleMenuItemClick('notion')}
							>
								<div class="flex items-center gap-2">
									<NotionLogo class="h-4 w-4" />
									<span>Notion Integration</span>
								</div>
							</DropdownMenu.Item>
						{/if}

						<DropdownMenu.Separator class="my-1 h-px bg-subtle-base" />

						<!-- Settings - Enhanced with clear icon and improved styling -->
						<DropdownMenu.Item
							class="flex h-10 items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-muted focus:bg-surface-muted focus:outline-none cursor-pointer min-h-[44px] touch-manipulation"
							onSelect={() => handleMenuItemClick('settings')}
						>
							<div class="flex items-center gap-2">
								<Settings class="h-4 w-4 text-foreground-secondary" />
								<span class="font-medium">Settings</span>
							</div>
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		</div>
	</div>
</div>