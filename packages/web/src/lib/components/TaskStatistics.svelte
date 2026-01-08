<script lang="ts">
interface Props {
	total: number;
	active: number;
	completed: number;
}

let { total, active, completed }: Props = $props();
</script>

<div class="grid grid-cols-3 gap-3 sm:gap-4">
	<div class="text-center p-3 sm:p-4 bg-surface-base rounded-xl">
		<div class="text-xl sm:text-2xl font-bold text-foreground-base">{total}</div>
		<div class="text-xs text-foreground-secondary uppercase tracking-wide">Total</div>
	</div>
	<div class="text-center p-3 sm:p-4 bg-warning-alert-bg rounded-xl">
		<div class="text-xl sm:text-2xl font-bold text-warning-foreground">{active}</div>
		<div class="text-xs text-warning-foreground uppercase tracking-wide">Active</div>
	</div>
	<div class="text-center p-3 sm:p-4 bg-success-alert-bg rounded-xl">
		<div class="text-xl sm:text-2xl font-bold text-success-foreground">{completed}</div>
		<div class="text-xs text-success-foreground uppercase tracking-wide">Done</div>
	</div>
</div>