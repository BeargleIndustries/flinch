// Cross-origin access to the sidecar (plan 6.3, K5). The preview origin and the
// sidecar differ by port, so a direct fetch from the page is cross-origin. The
// desktop WebView origin is checked with an explicit preflight: Starlette only
// treats OPTIONS as a preflight when Access-Control-Request-Method is present.
import { expect, test } from '@playwright/test';
import { BLANK_PAGE, sidecarUrl } from './helpers';

test('a page on the preview origin reads the sidecar /health directly', async ({ page }) => {
  await page.goto(BLANK_PAGE);
  const target = `${sidecarUrl()}/health`;
  expect(new URL(target).origin).not.toBe(new URL(page.url()).origin);
  const result = await page.evaluate(async (url) => {
    const res = await fetch(url);
    return { status: res.status, body: (await res.json()) as { status?: string } };
  }, target);
  expect(result.status).toBe(200);
  expect(result.body.status).toBe('ok');
});

test('an OPTIONS preflight from http://tauri.localhost is admitted', async ({ request }) => {
  const res = await request.fetch(`${sidecarUrl()}/api/sessions`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://tauri.localhost',
      'Access-Control-Request-Method': 'GET',
    },
  });
  expect(res.status()).toBe(200);
  expect(res.headers()['access-control-allow-origin']).toBe('http://tauri.localhost');
});
