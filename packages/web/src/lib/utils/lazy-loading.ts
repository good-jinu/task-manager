/**
 * Lazy loading utilities for components and resources
 * Provides efficient component loading with preloading strategies
 */

// Component type definitions
export type ComponentModule = {
	default: unknown;
	[key: string]: unknown;
};

export interface LazyComponentConfig {
	loader: () => Promise<ComponentModule>;
	fallback?: ComponentModule;
	preload?: boolean;
	preloadTrigger?: "hover" | "focus" | "visible" | "immediate";
	retryAttempts?: number;
	retryDelay?: number;
}

export interface PreloadConfig {
	components: Record<string, () => Promise<ComponentModule>>;
	triggers: Record<string, string[]>;
	strategy: "eager" | "lazy" | "viewport" | "interaction";
}

/**
 * Lazy component loader with preloading support
 */
export class LazyComponentLoader {
	private loadedComponents = new Map<string, ComponentModule>();
	private loadingPromises = new Map<string, Promise<ComponentModule>>();
	private preloadConfig: PreloadConfig;
	private intersectionObserver?: IntersectionObserver;

	constructor(config: PreloadConfig) {
		this.preloadConfig = config;
		this.setupIntersectionObserver();
	}

	/**
	 * Load component lazily
	 */
	async loadComponent(
		name: string,
		config?: LazyComponentConfig,
	): Promise<ComponentModule> {
		// Return cached component if already loaded
		if (this.loadedComponents.has(name)) {
			const cached = this.loadedComponents.get(name);
			if (cached) {
				return cached;
			}
		}

		// Return existing loading promise if already loading
		if (this.loadingPromises.has(name)) {
			const existing = this.loadingPromises.get(name);
			if (existing) {
				return existing;
			}
		}

		// Get loader from config or provided config
		const loader = config?.loader || this.preloadConfig.components[name];
		if (!loader) {
			throw new Error(`No loader found for component: ${name}`);
		}

		// Create loading promise with retry logic
		const loadingPromise = this.loadWithRetry(
			loader,
			config?.retryAttempts || 3,
			config?.retryDelay || 1000,
		);

		this.loadingPromises.set(name, loadingPromise);

		try {
			const component = await loadingPromise;
			this.loadedComponents.set(name, component);
			this.loadingPromises.delete(name);
			return component;
		} catch (error) {
			this.loadingPromises.delete(name);
			throw error;
		}
	}

	/**
	 * Preload component based on trigger
	 */
	preloadComponent(name: string, trigger: string = "immediate"): void {
		// Don't preload if already loaded or loading
		if (this.loadedComponents.has(name) || this.loadingPromises.has(name)) {
			return;
		}

		const loader = this.preloadConfig.components[name];
		if (!loader) return;

		switch (trigger) {
			case "immediate":
				this.loadComponent(name);
				break;
			case "hover":
			case "focus":
				// These are handled by event listeners in components
				break;
			case "visible":
				// Handled by intersection observer
				break;
		}
	}

	/**
	 * Preload components based on triggers
	 */
	preloadForTrigger(triggerName: string): void {
		const components = this.preloadConfig.triggers[triggerName];
		if (!components) return;

		for (const componentName of components) {
			this.preloadComponent(componentName);
		}
	}

	/**
	 * Setup intersection observer for viewport-based preloading
	 */
	private setupIntersectionObserver(): void {
		if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
			return;
		}

		this.intersectionObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						const componentName = entry.target.getAttribute(
							"data-lazy-component",
						);
						if (componentName) {
							this.preloadComponent(componentName, "visible");
						}
					}
				}
			},
			{
				rootMargin: "50px", // Start loading 50px before element is visible
				threshold: 0.1,
			},
		);
	}

	/**
	 * Observe element for viewport-based preloading
	 */
	observeElement(element: Element, componentName: string): void {
		if (this.intersectionObserver) {
			element.setAttribute("data-lazy-component", componentName);
			this.intersectionObserver.observe(element);
		}
	}

	/**
	 * Stop observing element
	 */
	unobserveElement(element: Element): void {
		if (this.intersectionObserver) {
			this.intersectionObserver.unobserve(element);
		}
	}

	/**
	 * Load with retry logic
	 */
	private async loadWithRetry(
		loader: () => Promise<ComponentModule>,
		maxAttempts: number,
		delay: number,
	): Promise<ComponentModule> {
		let lastError: Error | undefined;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				return await loader();
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				if (attempt === maxAttempts) {
					throw lastError;
				}

				// Wait before retry with exponential backoff
				await new Promise((resolve) =>
					setTimeout(resolve, delay * 2 ** (attempt - 1)),
				);
			}
		}

		if (lastError) {
			throw lastError;
		}
		throw new Error("Failed to load component after all retry attempts");
	}

	/**
	 * Get loading statistics
	 */
	getStats(): {
		loaded: number;
		loading: number;
		total: number;
	} {
		return {
			loaded: this.loadedComponents.size,
			loading: this.loadingPromises.size,
			total: Object.keys(this.preloadConfig.components).length,
		};
	}

	/**
	 * Clear all loaded components
	 */
	clear(): void {
		this.loadedComponents.clear();
		this.loadingPromises.clear();
	}

	/**
	 * Destroy loader and cleanup
	 */
	destroy(): void {
		this.clear();
		if (this.intersectionObserver) {
			this.intersectionObserver.disconnect();
		}
	}
}

/**
 * Resource preloader for common user actions
 */
export class ResourcePreloader {
	private preloadedResources = new Set<string>();
	private preloadPromises = new Map<string, Promise<Response | null>>();

	/**
	 * Preload API endpoint
	 */
	async preloadEndpoint(
		url: string,
		options: RequestInit = {},
	): Promise<Response | null> {
		if (this.preloadedResources.has(url)) {
			return null; // Already preloaded
		}

		if (this.preloadPromises.has(url)) {
			const existingPromise = this.preloadPromises.get(url);
			return existingPromise || null;
		}

		const preloadPromise = fetch(url, {
			...options,
			// Use low priority for preloading
			priority: "low" as RequestInit["priority"],
		})
			.then((response) => {
				this.preloadedResources.add(url);
				this.preloadPromises.delete(url);
				return response;
			})
			.catch((error) => {
				this.preloadPromises.delete(url);
				console.warn(`Failed to preload ${url}:`, error);
				return null;
			});

		this.preloadPromises.set(url, preloadPromise);
		return preloadPromise;
	}

	/**
	 * Preload multiple endpoints
	 */
	async preloadEndpoints(urls: string[]): Promise<void> {
		const promises = urls.map((url) => this.preloadEndpoint(url));
		await Promise.allSettled(promises);
	}

	/**
	 * Check if resource is preloaded
	 */
	isPreloaded(url: string): boolean {
		return this.preloadedResources.has(url);
	}

	/**
	 * Clear preloaded resources
	 */
	clear(): void {
		this.preloadedResources.clear();
		this.preloadPromises.clear();
	}
}

/**
 * Integration-specific lazy loading configuration
 */
export const integrationLazyConfig: PreloadConfig = {
	components: {
		NotionIntegrationDialog: () =>
			import("../components/NotionIntegrationDialog.svelte"),
		IntegrationStatusBadge: () =>
			import("../components/IntegrationStatusBadge.svelte"),
		SettingsDrawer: () => import("../components/SettingsDrawer.svelte"),
	},
	triggers: {
		settingsOpen: ["IntegrationStatusBadge"],
		integrationToggle: ["NotionIntegrationDialog"],
		statusClick: [],
	},
	strategy: "interaction",
};

/**
 * Global lazy component loader
 */
export const lazyLoader = new LazyComponentLoader(integrationLazyConfig);

/**
 * Global resource preloader
 */
export const resourcePreloader = new ResourcePreloader();

/**
 * Preload common integration resources
 */
export function preloadIntegrationResources(workspaceId: string): void {
	const commonEndpoints = [
		`/api/integrations/status?workspaceId=${workspaceId}`,
		"/api/integrations/notion/databases",
		`/api/workspaces/${workspaceId}/integrations`,
	];

	resourcePreloader.preloadEndpoints(commonEndpoints);
}

/**
 * Svelte action for lazy loading components on hover
 */
export function lazyOnHover(node: Element, componentName: string) {
	let preloaded = false;

	function handleMouseEnter() {
		if (!preloaded) {
			lazyLoader.preloadComponent(componentName, "hover");
			preloaded = true;
		}
	}

	node.addEventListener("mouseenter", handleMouseEnter, { once: true });

	return {
		destroy() {
			node.removeEventListener("mouseenter", handleMouseEnter);
		},
	};
}

/**
 * Svelte action for lazy loading components on focus
 */
export function lazyOnFocus(node: Element, componentName: string) {
	let preloaded = false;

	function handleFocus() {
		if (!preloaded) {
			lazyLoader.preloadComponent(componentName, "focus");
			preloaded = true;
		}
	}

	node.addEventListener("focus", handleFocus, { once: true });

	return {
		destroy() {
			node.removeEventListener("focus", handleFocus);
		},
	};
}

/**
 * Svelte action for lazy loading components when visible
 */
export function lazyOnVisible(node: Element, componentName: string) {
	lazyLoader.observeElement(node, componentName);

	return {
		destroy() {
			lazyLoader.unobserveElement(node);
		},
	};
}

// Cleanup on page unload
if (typeof window !== "undefined") {
	window.addEventListener("beforeunload", () => {
		lazyLoader.destroy();
		resourcePreloader.clear();
	});
}
