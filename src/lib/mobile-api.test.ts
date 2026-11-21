import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { DEFAULT_API_BASE_URL, resolveApiUrl } from './api';
import { corsHeaders, withCors } from './cors';

describe('native hosted API selection', () => {
  test('web chat remains relative', () => assert.equal(resolveApiUrl('/api/chat', false), '/api/chat'));
  test('native chat defaults to the published app', () => assert.equal(resolveApiUrl('/api/chat', true), 'https://triage-ally-ai.lovable.app/api/chat'));
  test('native practice uses the configured origin without double slashes', () => assert.equal(resolveApiUrl('/api/public/practice', true, 'https://example.com/'), 'https://example.com/api/public/practice'));
  test('published default is an HTTPS origin', () => assert.equal(new URL(DEFAULT_API_BASE_URL).protocol, 'https:'));
});

describe('native CORS', () => {
  for (const origin of ['capacitor://localhost', 'http://localhost']) {
    test(`permits ${origin} on errors and stream responses`, async () => {
      const request = new Request('https://example.com/api/chat', { headers: { Origin: origin } });
      assert.equal(corsHeaders(request).get('Access-Control-Allow-Origin'), origin);
      const response = withCors(request, new Response('error', { status: 400 }));
      assert.equal(response.status, 400);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
      assert.equal(await response.text(), 'error');
    });
  }
  test('does not permit arbitrary origins', () => {
    const request = new Request('https://example.com/api/chat', { headers: { Origin: 'https://untrusted.example' } });
    assert.equal(corsHeaders(request).has('Access-Control-Allow-Origin'), false);
  });
});