/**
 * Mobile performance optimization utilities
 * Provides touch gesture optimization, reduced motion support, and performance monitoring
 */

// Extended navigator interface for device memory and connection
interface ExtendedNavigator extends Navigator {
	deviceMemory?: number;
	connection?: {
		effectiveType?: string;
	};
}

export interface TouchGestureConfig {
	swipeThreshold: number;
	tapTimeout: number;
	longPressTimeout: number;
	preventScroll: boolean;
}

export interface PerformanceMetrics {
	touchLatency: number;
	renderTime: number;
	scrollPerformance: number;
	memoryUsage?: number;
}

export interface MobileCapabilities {
	hasTouch: boolean;
	hasHaptics: boolean;
	prefersReducedMotion: boolean;
	isLowEndDevice: boolean;
	connectionType: string;
	devicePixelRatio: number;
}

/**
 * Detect mobile capabilities and preferences
 */
export function detectMobileCapabilities(): MobileCapabilities {
	// Return default values during SSR
	if (typeof window === "undefined") {
		return {
			hasTouch: false,
			hasHaptics: false,
			prefersReducedMotion: false,
			isLowEndDevice: false,
			connectionType: "unknown",
			devicePixelRatio: 1,
		};
	}

	const hasTouch =
		"ontouchstart" in window ||
		(typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
	const hasHaptics = typeof navigator !== "undefined" && "vibrate" in navigator;
	const prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;

	// Detect low-end devices based on hardware concurrency and memory
	const isLowEndDevice = (() => {
		if (typeof navigator === "undefined") return false;

		const hardwareConcurrency = navigator.hardwareConcurrency || 1;
		const deviceMemory = (navigator as ExtendedNavigator).deviceMemory || 1;
		return hardwareConcurrency <= 2 || deviceMemory <= 2;
	})();

	// Get connection type if available
	const connection =
		typeof navigator !== "undefined"
			? (navigator as ExtendedNavigator).connection
			: null;
	const connectionType = connection
		? connection.effectiveType || "unknown"
		: "unknown";

	const devicePixelRatio = window.devicePixelRatio || 1;

	return {
		hasTouch,
		hasHaptics,
		prefersReducedMotion,
		isLowEndDevice,
		connectionType,
		devicePixelRatio,
	};
}

/**
 * Touch gesture handler with optimization
 */
export class TouchGestureHandler {
	private config: TouchGestureConfig;
	private touchStart: { x: number; y: number; time: number } | null = null;
	private touchTimeout: number | null = null;
	private longPressTimeout: number | null = null;

	constructor(config: Partial<TouchGestureConfig> = {}) {
		this.config = {
			swipeThreshold: 50,
			tapTimeout: 300,
			longPressTimeout: 500,
			preventScroll: false,
			...config,
		};
	}

	/**
	 * Handle touch start with performance optimization
	 */
	handleTouchStart(
		event: TouchEvent,
		callbacks: {
			onTap?: (event: TouchEvent) => void;
			onLongPress?: (event: TouchEvent) => void;
			onSwipe?: (
				direction: "left" | "right" | "up" | "down",
				event: TouchEvent,
			) => void;
		},
	): void {
		const touch = event.touches[0];
		if (!touch) return;

		this.touchStart = {
			x: touch.clientX,
			y: touch.clientY,
			time: Date.now(),
		};

		// Clear existing timeouts
		this.clearTimeouts();

		// Set up long press detection
		if (callbacks.onLongPress && typeof window !== "undefined") {
			this.longPressTimeout = window.setTimeout(() => {
				if (this.touchStart) {
					callbacks.onLongPress?.(event);
					this.touchStart = null;
				}
			}, this.config.longPressTimeout);
		}

		// Prevent scroll if configured
		if (this.config.preventScroll) {
			event.preventDefault();
		}
	}

	/**
	 * Handle touch end with gesture recognition
	 */
	handleTouchEnd(
		event: TouchEvent,
		callbacks: {
			onTap?: (event: TouchEvent) => void;
			onLongPress?: (event: TouchEvent) => void;
			onSwipe?: (
				direction: "left" | "right" | "up" | "down",
				event: TouchEvent,
			) => void;
		},
	): void {
		if (!this.touchStart) return;

		const touch = event.changedTouches[0];
		if (!touch) return;

		const deltaX = touch.clientX - this.touchStart.x;
		const deltaY = touch.clientY - this.touchStart.y;
		const deltaTime = Date.now() - this.touchStart.time;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		this.clearTimeouts();

		// Determine gesture type
		if (distance > this.config.swipeThreshold && callbacks.onSwipe) {
			// Swipe gesture
			const direction =
				Math.abs(deltaX) > Math.abs(deltaY)
					? deltaX > 0
						? "right"
						: "left"
					: deltaY > 0
						? "down"
						: "up";

			callbacks.onSwipe(direction, event);
		} else if (
			deltaTime < this.config.tapTimeout &&
			distance < 10 &&
			callbacks.onTap
		) {
			// Tap gesture
			callbacks.onTap(event);
		}

		this.touchStart = null;
	}

	/**
	 * Handle touch move for scroll prevention and gesture cancellation
	 */
	handleTouchMove(event: TouchEvent): void {
		if (this.config.preventScroll) {
			event.preventDefault();
		}

		// Cancel long press if movement exceeds jitter threshold
		if (this.touchStart && this.longPressTimeout) {
			const touch = event.touches[0];
			if (touch) {
				const deltaX = touch.clientX - this.touchStart.x;
				const deltaY = touch.clientY - this.touchStart.y;
				const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

				// Cancel long press if movement exceeds 10px (jitter threshold)
				if (distance > 10) {
					clearTimeout(this.longPressTimeout);
					this.longPressTimeout = null;
				}
			}
		}
	}

	/**
	 * Clear all timeouts
	 */
	private clearTimeouts(): void {
		if (this.touchTimeout && typeof window !== "undefined") {
			clearTimeout(this.touchTimeout);
			this.touchTimeout = null;
		}
		if (this.longPressTimeout && typeof window !== "undefined") {
			clearTimeout(this.longPressTimeout);
			this.longPressTimeout = null;
		}
	}

	/**
	 * Destroy handler and cleanup
	 */
	destroy(): void {
		this.clearTimeouts();
		this.touchStart = null;
	}
}

/**
 * Haptic feedback utility
 */
export class HapticFeedback {
	private isSupported: boolean;

	constructor() {
		// Only initialize in browser environment
		if (typeof navigator !== "undefined") {
			this.isSupported = "vibrate" in navigator;
		} else {
			this.isSupported = false;
		}
	}

	/**
	 * Light haptic feedback for UI interactions
	 */
	light(): void {
		if (this.isSupported) {
			navigator.vibrate(10);
		}
	}

	/**
	 * Medium haptic feedback for confirmations
	 */
	medium(): void {
		if (this.isSupported) {
			navigator.vibrate(20);
		}
	}

	/**
	 * Heavy haptic feedback for errors or important actions
	 */
	heavy(): void {
		if (this.isSupported) {
			navigator.vibrate([30, 10, 30]);
		}
	}

	/**
	 * Success haptic pattern
	 */
	success(): void {
		if (this.isSupported) {
			navigator.vibrate([10, 5, 10]);
		}
	}

	/**
	 * Error haptic pattern
	 */
	error(): void {
		if (this.isSupported) {
			navigator.vibrate([50, 25, 50, 25, 50]);
		}
	}

	/**
	 * Custom haptic pattern
	 */
	custom(pattern: number | number[]): void {
		if (this.isSupported) {
			navigator.vibrate(pattern);
		}
	}
}

/**
 * Performance monitor for mobile interactions
 */
export class MobilePerformanceMonitor {
	private metrics: PerformanceMetrics[] = [];
	private observer?: PerformanceObserver;

	constructor() {
		// Only setup performance observer in browser environment
		if (typeof window !== "undefined") {
			this.setupPerformanceObserver();
		}
	}

	/**
	 * Measure touch latency
	 */
	measureTouchLatency(startTime: number): number {
		if (typeof performance === "undefined") return 0;

		const latency = performance.now() - startTime;
		this.recordMetric("touchLatency", latency);
		return latency;
	}

	/**
	 * Measure render time with accurate paint timing
	 */
	measureRenderTime(callback: () => void): Promise<number> {
		return new Promise((resolve) => {
			if (typeof window === "undefined") {
				// Return 0 during SSR
				resolve(0);
				return;
			}

			const startTime = performance.now();

			callback();

			// Use double requestAnimationFrame to measure after paint
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					const renderTime = performance.now() - startTime;
					this.recordMetric("renderTime", renderTime);
					resolve(renderTime);
				});
			});
		});
	}

	/**
	 * Measure scroll performance
	 */
	measureScrollPerformance(): () => void {
		// Return no-op function during SSR
		if (typeof window === "undefined") {
			return () => {};
		}

		let lastScrollTime = 0;
		let frameCount = 0;
		let totalTime = 0;

		const handleScroll = () => {
			const currentTime = performance.now();
			if (lastScrollTime > 0) {
				const frameDuration = currentTime - lastScrollTime;
				totalTime += frameDuration;
				frameCount++;

				// Calculate average FPS over last 10 frames
				if (frameCount >= 10) {
					const avgFrameTime = totalTime / frameCount;
					const fps = 1000 / avgFrameTime;
					this.recordMetric("scrollPerformance", fps);

					// Reset counters
					frameCount = 0;
					totalTime = 0;
				}
			}
			lastScrollTime = currentTime;
		};

		// Throttle scroll handler for performance
		let ticking = false;
		const throttledHandler = () => {
			if (!ticking) {
				requestAnimationFrame(() => {
					handleScroll();
					ticking = false;
				});
				ticking = true;
			}
		};

		window.addEventListener("scroll", throttledHandler, { passive: true });

		// Return cleanup function
		return () => {
			window.removeEventListener("scroll", throttledHandler);
		};
	}

	/**
	 * Get memory usage if available
	 */
	getMemoryUsage(): number | undefined {
		if (typeof performance === "undefined") return undefined;

		const memory = (
			performance as {
				memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
			}
		).memory;
		if (memory) {
			return memory.usedJSHeapSize / memory.jsHeapSizeLimit;
		}
		return undefined;
	}

	/**
	 * Record performance metric
	 */
	private recordMetric(type: keyof PerformanceMetrics, value: number): void {
		const metric: Partial<PerformanceMetrics> = { [type]: value };

		// Add memory usage if available
		const memoryUsage = this.getMemoryUsage();
		if (memoryUsage !== undefined) {
			metric.memoryUsage = memoryUsage;
		}

		this.metrics.push(metric as PerformanceMetrics);

		// Keep only last 100 metrics
		if (this.metrics.length > 100) {
			this.metrics.shift();
		}
	}

	/**
	 * Setup performance observer for additional metrics
	 */
	private setupPerformanceObserver(): void {
		if (typeof window === "undefined" || !("PerformanceObserver" in window)) {
			return;
		}

		try {
			this.observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (entry.entryType === "measure") {
						this.recordMetric("renderTime", entry.duration);
					}
				}
			});

			this.observer.observe({ entryTypes: ["measure"] });
		} catch (error) {
			console.warn("Performance observer not supported:", error);
		}
	}

	/**
	 * Get performance statistics
	 */
	getStats(): {
		touchLatency: { avg: number; max: number; min: number };
		renderTime: { avg: number; max: number; min: number };
		scrollPerformance: { avg: number; max: number; min: number };
		memoryUsage?: { avg: number; max: number; min: number };
	} {
		const touchLatencies = this.metrics
			.map((m) => m.touchLatency)
			.filter((v): v is number => v !== undefined);
		const renderTimes = this.metrics
			.map((m) => m.renderTime)
			.filter((v): v is number => v !== undefined);
		const scrollPerfs = this.metrics
			.map((m) => m.scrollPerformance)
			.filter((v): v is number => v !== undefined);
		const memoryUsages = this.metrics
			.map((m) => m.memoryUsage)
			.filter((v): v is number => v !== undefined);

		const calculateStats = (values: number[]) => {
			if (values.length === 0) return { avg: 0, max: 0, min: 0 };
			return {
				avg: values.reduce((a, b) => a + b, 0) / values.length,
				max: Math.max(...values),
				min: Math.min(...values),
			};
		};

		const stats: {
			touchLatency: { avg: number; max: number; min: number };
			renderTime: { avg: number; max: number; min: number };
			scrollPerformance: { avg: number; max: number; min: number };
			memoryUsage?: { avg: number; max: number; min: number };
		} = {
			touchLatency: calculateStats(touchLatencies),
			renderTime: calculateStats(renderTimes),
			scrollPerformance: calculateStats(scrollPerfs),
		};

		if (memoryUsages.length > 0) {
			stats.memoryUsage = calculateStats(memoryUsages);
		}

		return stats;
	}

	/**
	 * Clear all metrics
	 */
	clear(): void {
		this.metrics = [];
	}

	/**
	 * Destroy monitor and cleanup
	 */
	destroy(): void {
		if (this.observer) {
			this.observer.disconnect();
		}
		this.clear();
	}
}

/**
 * Progressive enhancement utility
 */
export class ProgressiveEnhancement {
	private capabilities: MobileCapabilities;

	constructor() {
		this.capabilities = detectMobileCapabilities();
	}

	/**
	 * Apply progressive enhancements based on device capabilities
	 */
	enhance(
		element: HTMLElement,
		options: {
			animations?: boolean;
			haptics?: boolean;
			touchOptimizations?: boolean;
			performanceOptimizations?: boolean;
		} = {},
	): void {
		const {
			animations = true,
			haptics = true,
			touchOptimizations = true,
			performanceOptimizations = true,
		} = options;

		// Apply reduced motion preferences
		if (animations && this.capabilities.prefersReducedMotion) {
			element.style.setProperty("--animation-duration", "0.01ms");
			element.style.setProperty("--transition-duration", "0.01ms");
		}

		// Apply touch optimizations
		if (touchOptimizations && this.capabilities.hasTouch) {
			element.style.touchAction = "manipulation";
			element.style.userSelect = "none";
		}

		// Apply performance optimizations for low-end devices
		if (performanceOptimizations && this.capabilities.isLowEndDevice) {
			element.style.willChange = "auto";
			element.style.transform = "translateZ(0)"; // Force hardware acceleration
		}

		// Add capability classes for CSS targeting
		element.classList.toggle("has-touch", this.capabilities.hasTouch);
		element.classList.toggle("has-haptics", this.capabilities.hasHaptics);
		element.classList.toggle(
			"prefers-reduced-motion",
			this.capabilities.prefersReducedMotion,
		);
		element.classList.toggle(
			"low-end-device",
			this.capabilities.isLowEndDevice,
		);
	}

	/**
	 * Get device capabilities
	 */
	getCapabilities(): MobileCapabilities {
		return { ...this.capabilities };
	}

	/**
	 * Check if feature should be enabled based on capabilities
	 */
	shouldEnableFeature(
		feature: "animations" | "haptics" | "heavy-effects" | "background-sync",
	): boolean {
		switch (feature) {
			case "animations":
				return (
					!this.capabilities.prefersReducedMotion &&
					!this.capabilities.isLowEndDevice
				);
			case "haptics":
				return this.capabilities.hasHaptics;
			case "heavy-effects":
				return (
					!this.capabilities.isLowEndDevice &&
					this.capabilities.connectionType !== "slow-2g"
				);
			case "background-sync":
				return (
					this.capabilities.connectionType !== "slow-2g" &&
					!this.capabilities.isLowEndDevice
				);
			default:
				return true;
		}
	}
}

// Global instances - lazy initialization to avoid SSR issues
let _mobileCapabilities: MobileCapabilities | null = null;
let _hapticFeedback: HapticFeedback | null = null;
let _performanceMonitor: MobilePerformanceMonitor | null = null;
let _progressiveEnhancement: ProgressiveEnhancement | null = null;

export const mobileCapabilities = (() => {
	if (!_mobileCapabilities) {
		_mobileCapabilities = detectMobileCapabilities();
	}
	return _mobileCapabilities;
})();

export const hapticFeedback = (() => {
	if (!_hapticFeedback) {
		_hapticFeedback = new HapticFeedback();
	}
	return _hapticFeedback;
})();

export const performanceMonitor = (() => {
	if (!_performanceMonitor) {
		_performanceMonitor = new MobilePerformanceMonitor();
	}
	return _performanceMonitor;
})();

export const progressiveEnhancement = (() => {
	if (!_progressiveEnhancement) {
		_progressiveEnhancement = new ProgressiveEnhancement();
	}
	return _progressiveEnhancement;
})();

/**
 * Svelte action for touch gesture handling
 */
export function touchGestures(
	node: HTMLElement,
	config: {
		onTap?: (event: TouchEvent) => void;
		onLongPress?: (event: TouchEvent) => void;
		onSwipe?: (
			direction: "left" | "right" | "up" | "down",
			event: TouchEvent,
		) => void;
		gestureConfig?: Partial<TouchGestureConfig>;
	},
) {
	// Skip setup during SSR
	if (typeof window === "undefined") {
		return {
			update() {},
			destroy() {},
		};
	}

	const handler = new TouchGestureHandler(config.gestureConfig);
	let currentConfig = config;

	const handleTouchStart = (event: TouchEvent) => {
		handler.handleTouchStart(event, currentConfig);
	};

	const handleTouchEnd = (event: TouchEvent) => {
		handler.handleTouchEnd(event, currentConfig);
	};

	const handleTouchMove = (event: TouchEvent) => {
		handler.handleTouchMove(event);
	};

	// Use passive listeners unless preventScroll is enabled
	const passiveOption = {
		passive: !config.gestureConfig?.preventScroll,
	};

	node.addEventListener("touchstart", handleTouchStart, passiveOption);
	node.addEventListener("touchend", handleTouchEnd, passiveOption);
	node.addEventListener("touchmove", handleTouchMove, passiveOption);

	return {
		update(newConfig: typeof config) {
			currentConfig = newConfig;

			// If preventScroll setting changed, we need to re-register listeners
			const newPassiveOption = {
				passive: !newConfig.gestureConfig?.preventScroll,
			};

			if (newPassiveOption.passive !== passiveOption.passive) {
				// Remove old listeners
				node.removeEventListener("touchstart", handleTouchStart);
				node.removeEventListener("touchend", handleTouchEnd);
				node.removeEventListener("touchmove", handleTouchMove);

				// Add new listeners with correct passive setting
				node.addEventListener("touchstart", handleTouchStart, newPassiveOption);
				node.addEventListener("touchend", handleTouchEnd, newPassiveOption);
				node.addEventListener("touchmove", handleTouchMove, newPassiveOption);
			}
		},
		destroy() {
			node.removeEventListener("touchstart", handleTouchStart);
			node.removeEventListener("touchend", handleTouchEnd);
			node.removeEventListener("touchmove", handleTouchMove);
			handler.destroy();
		},
	};
}

/**
 * Svelte action for progressive enhancement
 */
export function progressiveEnhance(
	node: HTMLElement,
	options: {
		animations?: boolean;
		haptics?: boolean;
		touchOptimizations?: boolean;
		performanceOptimizations?: boolean;
	} = {},
) {
	// Skip during SSR
	if (typeof window === "undefined") {
		return {
			destroy() {},
		};
	}

	progressiveEnhancement.enhance(node, options);

	return {
		destroy() {
			// Cleanup if needed
		},
	};
}

// Cleanup on page unload
if (typeof window !== "undefined") {
	window.addEventListener("beforeunload", () => {
		if (_performanceMonitor) {
			_performanceMonitor.destroy();
		}
	});
}
