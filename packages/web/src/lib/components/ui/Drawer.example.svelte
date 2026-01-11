<script lang="ts">
import { Button, Drawer } from "$lib/components/ui";

let isOpen = $state(false);

function openDrawer() {
	isOpen = true;
}

function closeDrawer() {
	isOpen = false;
}
</script>

<!-- Example usage of the Drawer component -->
<div class="p-4">
	<h2 class="text-xl font-semibold mb-4">Drawer Component Examples</h2>
	
	<div class="space-y-4">
		<!-- Basic usage -->
		<Button onclick={openDrawer}>Open Settings Drawer</Button>
		
		<!-- Different sizes and positions -->
		<div class="flex gap-2">
			<Button onclick={() => isOpen = true} variant="outline">Small Drawer</Button>
			<Button onclick={() => isOpen = true} variant="outline">Medium Drawer</Button>
			<Button onclick={() => isOpen = true} variant="outline">Large Drawer</Button>
		</div>
	</div>
</div>

<!-- Basic Drawer -->
<Drawer
	{isOpen}
	title="Example Drawer"
	size="md"
	onClose={closeDrawer}
>
	<div class="space-y-4">
		<p class="text-foreground-secondary">
			This is an example of the reusable Drawer component.
		</p>
		
		<div class="space-y-2">
			<h3 class="font-medium">Features:</h3>
			<ul class="text-sm text-foreground-secondary space-y-1">
				<li>• Responsive sizing (sm, md, lg, xl)</li>
				<li>• Left or right positioning</li>
				<li>• Optional backdrop</li>
				<li>• Optional close button</li>
				<li>• Keyboard navigation (ESC to close)</li>
				<li>• Body scroll lock when open</li>
			</ul>
		</div>
		
		<Button onclick={closeDrawer} variant="primary">
			Close Drawer
		</Button>
	</div>
</Drawer>