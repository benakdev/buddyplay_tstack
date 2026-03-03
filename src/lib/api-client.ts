import { Capacitor } from '@capacitor/core';
// TODO: Look into using cap HTTP plugin for native API calls: https://capacitorjs.com/docs/apis/http
/**
 * Get the base URL for API calls
 * - On web: uses relative paths (same origin)
 * - On native: uses absolute URL from VITE_API_URL env variable
 */
export function getApiBaseUrl(): string {
  if (Capacitor.isNativePlatform()) {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) {
      throw new Error(
        'VITE_API_URL environment variable is not set. ' +
          'Please configure it in .env.production or Vercel project settings.'
      );
    }
    return apiUrl;
  }
  return '';
}

/**
 * Fetch API call with automatic base URL handling
 *
 * @example
 * const users = await apiFetch('/api/users');
 * const user = await apiFetch('/api/users/123', { method: 'GET' });
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;
  return fetch(url, options);
}

/**
 * Convenient JSON fetch helper
 *
 * @example
 * const data = await apiJson('/api/users');
 */
export async function apiJson<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(path, options);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
