const NATIVE_ORIGINS = new Set(['capacitor://localhost', 'http://localhost']);

export function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin');
  const headers = new Headers({ Vary: 'Origin' });
  if (origin && NATIVE_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    headers.set('Access-Control-Max-Age', '86400');
  }
  return headers;
}

export function withCors(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  corsHeaders(request).forEach((value, key) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}