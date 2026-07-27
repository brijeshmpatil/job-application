/**
 * Wrapper around fetch that adds ngrok-skip-browser-warning header.
 * Without this, ngrok free tier shows an interstitial page instead of JSON.
 */
export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const headers = new Headers(options?.headers);
  headers.set("ngrok-skip-browser-warning", "true");

  return fetch(url, {
    ...options,
    headers,
  });
}

export async function apiPost(
  url: string,
  body: unknown
): Promise<Response> {
  return apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
