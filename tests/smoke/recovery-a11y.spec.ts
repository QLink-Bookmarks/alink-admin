import { expect, test } from '@playwright/test';
import { installFixture } from '../fixtures/setup';

test('expired sessions remove protected content after another tab signs out', async ({ page }) => {
  const state = await installFixture(page);
  await page.goto('/providers/1');
  await expect(page.getByLabel('기본 URL')).toBeVisible();
  await page.clock.install();
  state.authenticated = false;
  await page.clock.fastForward(16 * 60_000);
  await page.getByRole('link', { name: '피드백', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('status')).toContainText('세션이 만료됐어요');
  await expect(page.getByLabel('기본 URL')).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});

test('late search responses cannot overwrite the latest Korean query and list loading is announced', async ({
  page,
}) => {
  const state = await installFixture(page);
  state.slowQuery = '공지 17';
  await page.goto('/announcements');
  await page.getByLabel('제목 검색').fill('공지 17');
  await expect(page.getByRole('heading', { name: '불러오는 중이에요' })).toBeVisible();
  await page.getByLabel('제목 검색').fill('공지 16');
  await expect(page.getByRole('link', { name: '공지 16', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '공지 17', exact: true })).toHaveCount(0);
  await expect
    .poll(() => state.requests.filter((request) => request.path.includes('query=')).length)
    .toBeGreaterThanOrEqual(3);
  await page.getByRole('link', { name: '공지 16', exact: true }).click();
  await expect(page.getByRole('heading', { name: '공지 16', exact: true })).toBeVisible();
});

test('model state idempotency, ordering and immutable fields survive reload', async ({ page }) => {
  const state = await installFixture(page);
  await page.goto('/providers/1');
  const menu = page.getByLabel('gemini-2.5-flash 행 메뉴').filter({ visible: true });
  await menu.focus();
  await page.keyboard.press('Enter');
  await page
    .getByRole('button', { name: '비활성화', exact: true })
    .filter({ visible: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '취소' })).toBeFocused();
  state.providers[0]!.models[0]!.isActive = false;
  await dialog.getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    state.requests.find((request) => request.path === '/api/ai/models/1/active')?.body,
  ).toEqual({ isActive: false });
  await menu.click();
  await page.getByRole('button', { name: '활성화', exact: true }).filter({ visible: true }).click();
  await dialog.getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('기본 URL')).toBeVisible();
  const ordered = page.locator(
    (page.viewportSize()?.width ?? 1280) <= 768
      ? '.model-cards .model-card strong'
      : '.wide-models tbody th .model-name',
  );
  expect((await ordered.allTextContents()).slice(0, 2)).toEqual([
    'gemini-2.5-flash',
    'gemini-model-2',
  ]);
  await expect(ordered.last()).toHaveAttribute('title', 'a'.repeat(100));
});

test('dialog focus stays trapped, visible controls meet target size and field contrast', async ({
  page,
}) => {
  await installFixture(page);
  await page.goto('/providers/1');
  await page.getByRole('button', { name: '모델 추가', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('모델 식별자', { exact: true })).toBeFocused();
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '모델 추가', exact: true })).toBeFocused();
  const audit = await page.evaluate(() => {
    const rgb = (color: string) => (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const luminance = (color: string) =>
      rgb(color)
        .map((value) => {
          const x = value / 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
    const contrast = (a: string, b: string) => {
      const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (values[0]! + 0.05) / (values[1]! + 0.05);
    };
    const input = document.querySelector<HTMLInputElement>('input')!;
    const style = getComputedStyle(input);
    const small = [
      ...document.querySelectorAll<HTMLElement>(
        'button, summary, nav a, .header-inner .brand, .provider-head h2 a',
      ),
    ]
      .filter((element) => element.checkVisibility())
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width < 40 || box.height < 40;
      })
      .map((element) => element.textContent);
    return {
      small,
      border: contrast(style.borderTopColor, style.backgroundColor),
      placeholder: contrast(getComputedStyle(input, '::placeholder').color, style.backgroundColor),
      outline: getComputedStyle(document.activeElement!).outlineStyle,
    };
  });
  expect(audit.small).toEqual([]);
  expect(audit.border).toBeGreaterThanOrEqual(3);
  expect(audit.placeholder).toBeGreaterThanOrEqual(4.5);
  expect(audit.outline).not.toBe('none');
});

test('dialogs stay centered with symmetric margins and scroll in a short viewport', async ({
  page,
}) => {
  await installFixture(page);
  await page.setViewportSize({ width: 390, height: 320 });
  await page.goto('/providers/1');
  await page.getByRole('button', { name: '모델 추가', exact: true }).click();
  const geometry = await page.getByRole('dialog').evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      left: box.left,
      right: innerWidth - box.right,
      top: box.top,
      bottom: innerHeight - box.bottom,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: style.overflowY,
      maxHeight: Number.parseFloat(style.maxHeight),
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(16);
  expect(geometry.right).toBeGreaterThanOrEqual(16);
  expect(Math.abs(geometry.left - geometry.right)).toBeLessThanOrEqual(1);
  expect(geometry.top).toBeGreaterThanOrEqual(24);
  expect(geometry.bottom).toBeGreaterThanOrEqual(24);
  expect(Math.abs(geometry.top - geometry.bottom)).toBeLessThanOrEqual(1);
  expect(geometry.overflowY).toBe('auto');
  expect(geometry.maxHeight).toBeLessThanOrEqual(272);
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
});
