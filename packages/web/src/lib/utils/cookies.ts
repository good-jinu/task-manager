/**
 * Modern cookie management utilities using the Cookie Store API when available,
 * falling back to document.cookie for compatibility
 */

export interface CookieOptions {
	path?: string;
	domain?: string;
	expires?: Date;
	maxAge?: number;
	secure?: boolean;
	sameSite?: "strict" | "lax" | "none";
}

interface CookieStoreInit {
	name: string;
	value: string;
	path?: string;
	domain?: string;
	expires?: number; // Cookie Store API expects timestamp in milliseconds
	maxAge?: number;
	secure?: boolean;
	sameSite?: "strict" | "lax" | "none";
}

/**
 * Set a cookie using modern Cookie Store API or fallback to document.cookie
 */
export async function setCookie(
	name: string,
	value: string,
	options: CookieOptions = {},
): Promise<void> {
	// Use Cookie Store API if available
	if ("cookieStore" in window) {
		try {
			const cookieInit: CookieStoreInit = {
				name,
				value,
				path: options.path,
				domain: options.domain,
				secure: options.secure,
				sameSite: options.sameSite,
			};

			// Convert Date to number for Cookie Store API
			if (options.expires) {
				cookieInit.expires = options.expires.getTime();
			}
			if (options.maxAge) {
				cookieInit.maxAge = options.maxAge;
			}

			await window.cookieStore.set(cookieInit);
			return;
		} catch (error) {
			console.warn(
				"Cookie Store API failed, falling back to document.cookie:",
				error,
			);
		}
	}

	// Fallback to document.cookie
	let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

	if (options.path) cookieString += `; path=${options.path}`;
	if (options.domain) cookieString += `; domain=${options.domain}`;
	if (options.expires)
		cookieString += `; expires=${options.expires.toUTCString()}`;
	if (options.maxAge) cookieString += `; max-age=${options.maxAge}`;
	if (options.secure) cookieString += "; secure";
	if (options.sameSite) cookieString += `; samesite=${options.sameSite}`;

	// biome-ignore lint/suspicious/noDocumentCookie: Fallback for browsers without Cookie Store API
	document.cookie = cookieString;
}

/**
 * Delete a cookie by setting it to expire in the past
 */
export async function deleteCookie(
	name: string,
	options: Pick<CookieOptions, "path" | "domain"> = {},
): Promise<void> {
	// Use Cookie Store API if available
	if ("cookieStore" in window) {
		try {
			await window.cookieStore.delete({
				name,
				...options,
			});
			return;
		} catch (error) {
			console.warn(
				"Cookie Store API failed, falling back to document.cookie:",
				error,
			);
		}
	}

	// Fallback: set cookie with past expiration date
	await setCookie(name, "", {
		...options,
		expires: new Date(0),
	});
}

/**
 * Get a cookie value using Cookie Store API or fallback to document.cookie
 */
export async function getCookie(name: string): Promise<string | null> {
	// Use Cookie Store API if available
	if ("cookieStore" in window) {
		try {
			const cookie = await window.cookieStore.get(name);
			return cookie?.value || null;
		} catch (error) {
			console.warn(
				"Cookie Store API failed, falling back to document.cookie:",
				error,
			);
		}
	}

	// Fallback to document.cookie parsing
	const cookies = document.cookie.split(";");
	for (const cookie of cookies) {
		const [cookieName, cookieValue] = cookie.trim().split("=");
		if (decodeURIComponent(cookieName) === name) {
			return decodeURIComponent(cookieValue);
		}
	}
	return null;
}
