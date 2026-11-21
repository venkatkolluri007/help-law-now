import { Capacitor } from '@capacitor/core';

export const DEFAULT_API_BASE_URL = 'https://triage-ally-ai.lovable.app';

export function resolveApiUrl(path: string, native: boolean, base = DEFAULT_API_BASE_URL) {
  return native ? `${base.replace(/\/+$/, '')}${path}` : path;
}

export function apiUrl(path: string) {
  return resolveApiUrl(path, Capacitor.isNativePlatform(), import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL);
}

// Uses fetch directly: the chat transport must retain its streaming response body.
export const apiFetch: typeof fetch = async (input, init) => {
  if (!navigator.onLine) throw new Error('You’re offline. Reconnect to the internet and try again.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init?.signal?.aborted) controller.abort();
  init?.signal?.addEventListener('abort', abort, { once: true });
  // Keep the deadline active while the response body streams, not just until headers arrive.
  const timer = setTimeout(() => {
    controller.abort();
    init?.signal?.removeEventListener('abort', abort);
  }, 180_000);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (!response.ok && response.headers.get('content-type')?.includes('text/html')) {
      clearTimeout(timer);
      throw new Error('We couldn’t reach Legal Ally. Please try again later.');
    }
    return response;
  } catch (error) {
    clearTimeout(timer);
    init?.signal?.removeEventListener('abort', abort);
    if (init?.signal?.aborted) throw error;
    throw new Error('We couldn’t reach Legal Ally. Check your connection and try again.');
  }
};

export async function submitPracticeRequest(data: FormData) {
  const response = await apiFetch(apiUrl('/api/public/practice'), { method: 'POST', body: data });
  if (!response.ok) throw new Error(await response.text() || 'Your listing could not be submitted. Please try again.');
  return response.json();
}