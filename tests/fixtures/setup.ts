import type { Page } from '@playwright/test';
import { createFixture, gisStub, handleFixture } from './admin-api';

export async function installFixture(page: Page, state = createFixture()) {
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: gisStub }),
  );
  await page.route('https://fixture.test/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    let body: Record<string, unknown> = {};
    if (request.headers()['content-type']?.includes('application/json'))
      body = request.postDataJSON() as Record<string, unknown>;
    const response = await handleFixture(
      state,
      request.method(),
      request.url(),
      body,
      request.headers(),
    );
    if (response.abort) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: response.status,
      contentType: 'application/json',
      body: JSON.stringify(
        response.code
          ? { success: false, error: { code: response.code, message: 'sensitive server detail' } }
          : { success: true, data: response.data },
      ),
    });
  });
  return state;
}
