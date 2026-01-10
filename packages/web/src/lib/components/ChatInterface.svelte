<script lang="ts">
import type { Task } from "@notion-task-manager/db";
import { DropdownMenu } from "bits-ui";
import ChatContainer from "./ChatContainer.svelte";
import ChatInput from "./ChatInput.svelte";
import { useChatMessages } from "./hooks/useChatMessages.svelte";
import { Menu, NotionLogo, Settings, User } from "./icons";

interface Props {
	workspaceId: string;
	tasks?: Task[];
	onTasksUpdate?: (tasks: Task[]) => void;
	isAuthenticated?: boolean;
	isGuestMode?: boolean;
	onMenuAction?: (action: string) => void;
}

let {
	workspaceId,
	tasks = [],
	onTasksUpdate,
	isAuthenticated = false,
	isGuestMode = false,
	onMenuAction,
}: Props = $props();

let input = $state("");
let showTaskOverview = $state(false);

const chatMessages = useChatMessages();

async function handleSendMessage(content: string) {
	await chatMessages.sendMessage(content, workspaceId, onTasksUpdate);
}

function toggleTaskOverview() {
	showTaskOverview = !showTaskOverview;
}

function handleMenuItemClick(action: string) {
	onMenuAction?.(action);
}
</script>

<div class="flex flex-col h-full bg-background-base">
	<!-- Header with Menu -->
	<div class="bg-surface-base border-b border-border-subtle">
		<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between h-14">
				<div class="flex items-center">
					<h1 class="text-lg font-semibold text-foreground">TaskFlow</h1>
				</div>
				
				<!-- Dropdown Menu -->
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-background hover:bg-muted text-foreground transition-colors"
					>
						<Menu class="h-5 w-5" />
					</DropdownMenu.Trigger>
					
					<DropdownMenu.Portal>
						<DropdownMenu.Content
							class="w-64 rounded-xl border border-muted bg-background shadow-popover px-1 py-1.5"
							sideOffset={8}
							align="end"
						>
							{#if isGuestMode && !isAuthenticated}
								<!-- Guest Mode Options -->
								<div class="px-3 py-2 border-b border-border-subtle mb-1">
									<div class="flex items-center gap-2 mb-1">
						 				<User class="h-4 w-4 text-accent" />
										<span class="text-sm font-medium text-accent">Guest Mode</span>
									</div>
									<p class="text-xs text-muted-foreground">Your tasks are saved locally</p>
								</div>
								
								<DropdownMenu.Item
									class="flex h-10 items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted focus:bg-muted focus:outline-none cursor-pointer"
									onSelect={() => handleMenuItemClick('signup')}
								>
									<div class="flex items-center gap-2">
										<User class="h-4 w-4 text-foreground-alt" />
										<span>Sign Up (Optional)</span>
									</div>
								</DropdownMenu.Item>
							{/if}
							
							{#if isAuthenticated}
								<!-- Authenticated User Options -->
								<div class="px-3 py-2 border-b border-border-subtle mb-1">
									<div class="flex items-center gap-2 mb-1">
										<User class="h-4 w-4 text-primary" />
										<span class="text-sm font-medium text-primary">Signed In</span>
									</div>
									<p class="text-xs text-muted-foreground">Sync across devices available</p>
								</div>
								
								<DropdownMenu.Item
									class="flex h-10 items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted focus:bg-muted focus:outline-none cursor-pointer"
									onSelect={() => handleMenuItemClick('notion')}
								>
									<div class="flex items-center gap-2">
										<NotionLogo class="h-4 w-4" />
										<span>Notion Integration</span>
									</div>
								</DropdownMenu.Item>
							{/if}
						</DropdownMenu.Content>
					</DropdownMenu.Portal>
				</DropdownMenu.Root>
			</div>
		</div>
	</div>

	<!-- Progressive Chat Interface -->
	<div class="flex-1 overflow-hidden">
		<!-- Chat Messages with Integrated Task UI -->
		<ChatContainer 
			messages={chatMessages.messages}
			{tasks}
			{showTaskOverview}
			onToggleTaskOverview={toggleTaskOverview}
		/>
	</div>

	<!-- Enhanced Chat Input -->
	<div class="bg-surface-base">
		<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
			<ChatInput
				bind:value={input}
				onSubmit={handleSendMessage}
				isLoading={chatMessages.isLoading}
				placeholder="Ask me to create tasks, organize your work, or help with planning..."
			/>
		</div>
	</div>
</div>