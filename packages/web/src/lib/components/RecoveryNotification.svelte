<script lang="ts">
import { CheckCircle, Close, Info } from "$lib/components/icons";

interface Props {
	show: boolean;
	type: "success" | "info" | "warning";
	title: string;
	message: string;
	taskCount?: number;
	onClose: () => void;
}

let {
	show = false,
	type,
	title,
	message,
	taskCount,
	onClose,
}: Props = $props();

let IconComponent = $derived(() => {
	switch (type) {
		case "success":
			return CheckCircle;
		default:
			return Info;
	}
});

function getStyles() {
	switch (type) {
		case "success":
			return "bg-success/10 border-success/20 text-success";
		case "warning":
			return "bg-warning/10 border-warning/20 text-warning";
		default:
			return "bg-info/10 border-info/20 text-info";
	}
}
</script>

{#if show}
	<div class="fixed top-4 right-4 z-50 max-w-md">
		<div class="border rounded-xl p-4 shadow-lg backdrop-blur-sm {getStyles()}">
			<div class="flex items-start gap-3">
				<IconComponent class="w-5 h-5 mt-0.5 flex-shrink-0" />
				<div class="flex-1 min-w-0">
					<h4 class="font-semibold text-sm mb-1">{title}</h4>
					<p class="text-sm opacity-90">{message}</p>
					{#if taskCount !== undefined && taskCount > 0}
						<p class="text-xs mt-2 opacity-75">
							✅ Recovered {taskCount} task{taskCount === 1 ? '' : 's'}
						</p>
					{/if}
				</div>
				<button
					onclick={onClose}
					class="flex-shrink-0 p-1 hover:bg-black/10 rounded-lg transition-colors"
					aria-label="Close notification"
				>
					<Close class="w-4 h-4" />
				</button>
			</div>
		</div>
	</div>
{/if}