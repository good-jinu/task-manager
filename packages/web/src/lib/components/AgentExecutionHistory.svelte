<script lang="ts">
import type { AgentExecutionRecord } from "@task-manager/db";
import { onMount } from "svelte";
import { LoadingSpinner } from "$lib/components";

let executions: AgentExecutionRecord[] = $state([]);
let loading = $state(true);
let error = $state("");

onMount(async () => {
	await loadExecutions();
});

async function loadExecutions() {
	loading = true;
	error = "";

	try {
		const response = await fetch("/api/agent/executions");
		const data = await response.json();

		if (response.ok) {
			executions = data.executions || [];
		} else {
			error = data.error || "Failed to load execution history";
		}
	} catch (err) {
		error = "Failed to load execution history";
		console.error("Error loading executions:", err);
	} finally {
		loading = false;
	}
}

function formatTimestamp(timestamp: string) {
	return new Date(timestamp).toLocaleString();
}

function getStatusColor(status: string) {
	switch (status) {
		case "done":
			return "text-success";
		case "fail":
			return "text-error";
		case "pending":
			return "text-warning";
		default:
			return "text-muted-foreground";
	}
}
</script>

<div class="bg-surface-base border border-subtle-base rounded-lg p-4">
	<h3 class="text-lg font-semibold text-foreground-base mb-4">AI Execution History</h3>
	
	{#if loading}
		<LoadingSpinner text="Loading execution history..." />
	{:else if error}
		<div class="text-error p-4 bg-error-alert-bg border border-error-border rounded">
			{error}
		</div>
	{:else if executions.length === 0}
		<div class="text-muted-foreground p-4 text-center">
			No AI executions yet. Try asking the AI to help with your tasks!
		</div>
	{:else}
		<div class="space-y-3">
			{#each executions as execution (execution.executionId)}
				<div class="border border-subtle-base rounded-lg p-3">
					<div class="flex items-start justify-between mb-2">
						<div class="flex-1">
							<div class="font-medium text-foreground-base">{execution.query}</div>
							<div class="text-sm text-muted-foreground">
								{formatTimestamp(execution.createdAt)}
							</div>
						</div>
						<div class="ml-4">
							<span class="px-2 py-1 text-xs rounded-full {getStatusColor(execution.status)} bg-surface-muted">
								{execution.status}
							</span>
						</div>
					</div>
					
					{#if execution.result}
						<div class="mt-2 p-2 bg-surface-muted rounded text-sm">
							<div class="font-medium">Result:</div>
							<div class="text-muted-foreground">{execution.result.reasoning}</div>
							{#if execution.result.action !== "none"}
								<div class="mt-1 text-success">Action: {execution.result.action}</div>
							{/if}
						</div>
					{/if}
					
					{#if execution.error}
						<div class="mt-2 p-2 bg-error-alert-bg border border-error-border rounded text-sm text-error">
							Error: {execution.error}
						</div>
					{/if}
					
					{#if execution.steps && execution.steps.length > 0}
						<details class="mt-2">
							<summary class="cursor-pointer text-sm text-accent hover:text-accent-button-hover">
								View Steps ({execution.steps.length})
							</summary>
							<div class="mt-2 space-y-2">
								{#each execution.steps as step}
									<div class="p-2 bg-surface-muted rounded text-xs">
										<div class="font-medium">{step.toolName}</div>
										{#if step.input}
											<div class="text-muted-foreground">Input: {JSON.stringify(step.input)}</div>
										{/if}
										{#if step.output}
											<div class="text-success">Output: {JSON.stringify(step.output)}</div>
										{/if}
										{#if step.error}
											<div class="text-error">Error: {step.error}</div>
										{/if}
									</div>
								{/each}
							</div>
						</details>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>