import { expect, test } from '@playwright/test';
import { installFixture } from '../fixtures/setup';

test('provider URL validation, normalization, state confirmations and missing adapter', async ({
  page,
}) => {
  const state = await installFixture(page);
  await page.goto('/providers/1');
  await expect(page.getByText('활성 모델 3개 / 전체 4개')).toBeVisible();
  const url = page.getByLabel('기본 URL');
  for (const value of [
    'http://generativelanguage.googleapis.com',
    'https://evil.test',
    'https://user@generativelanguage.googleapis.com',
    'https://generativelanguage.googleapis.com/?a=b',
  ]) {
    await url.fill(value);
    await page.getByRole('button', { name: '주소 저장' }).click();
    await expect(page.getByText('업체의 공식 API 주소만 쓸 수 있어요')).toBeVisible();
    await expect(url).toHaveValue(value);
  }
  await url.fill('https://generativelanguage.googleapis.com/v1beta/');
  await page.getByRole('button', { name: '주소 저장' }).click();
  await expect(url).toHaveValue('https://generativelanguage.googleapis.com/v1beta');
  expect(
    state.requests.find(
      (request) => request.method === 'PUT' && request.path === '/api/ai/providers/1',
    )?.body,
  ).toEqual({ baseUrl: 'https://generativelanguage.googleapis.com/v1beta/' });
  const trigger = page.getByRole('button', { name: '제공자 비활성화', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('활성 모델 3개');
  await expect(dialog.getByRole('button', { name: '취소' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole('button', { name: '확인', exact: true }).click();
  await expect(
    page.getByText('이 제공자의 모든 모델은 사용자에게 숨겨져요.', { exact: false }),
  ).toBeVisible();
  expect(state.providers[0]?.isActive).toBe(false);
  await page.getByRole('button', { name: '제공자 활성화', exact: true }).click();
  await dialog.getByRole('button', { name: '확인', exact: true }).click();
  expect(state.providers[0]?.isActive).toBe(true);
  await page.goto('/providers/3');
  const unavailable = page.getByRole('button', { name: '제공자 활성화', exact: true });
  await expect(unavailable).toHaveAttribute('aria-disabled', 'true');
  await unavailable.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(unavailable).toBeFocused();
});

test('models validate immutable identity, duplicate names, positive limits and preserve failed edits', async ({
  page,
}) => {
  const state = await installFixture(page);
  await page.goto('/providers/1');
  const add = page.getByRole('button', { name: '모델 추가', exact: true });
  await add.click();
  const dialog = page.getByRole('dialog');
  const name = dialog.getByLabel('모델 식별자', { exact: true });
  await expect(name).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  for (const value of ['', 'x'.repeat(101), '한글', 'a/b', ' a']) {
    await name.fill(value);
    await dialog.getByRole('button', { name: '추가', exact: true }).click();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
  }
  await name.fill('gemini-2.5-flash');
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(dialog.getByText('이미 등록된 모델이에요').first()).toBeVisible();
  await name.fill('gemini-new');
  for (const value of ['0', '-1', '1.5', 'letters']) {
    await dialog.getByLabel('우선순위', { exact: true }).fill(value);
    await dialog.getByRole('button', { name: '추가', exact: true }).click();
    await expect(dialog.getByLabel('우선순위', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  }
  await dialog.getByLabel('우선순위', { exact: true }).fill('1');
  await dialog.getByLabel('일일 요청 제한', { exact: true }).fill('0');
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(dialog.getByLabel('일일 요청 제한', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await dialog.getByLabel('일일 요청 제한', { exact: true }).fill('');
  state.fail = 'POST /api/ai/models';
  state.failStatus = 0;
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('저장하지 못했어요');
  await expect(name).toHaveValue('gemini-new');
  state.fail = '';
  state.delay = 300;
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '저장 중…' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expect(dialog.getByRole('button', { name: '저장 중…' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.providers[0]?.models.filter((model) => model.model === 'gemini-new')).toHaveLength(
    1,
  );
  state.delay = 0;
  const menu = page.getByLabel('gemini-2.5-flash 행 메뉴').filter({ visible: true });
  await menu.click();
  await page.getByRole('button', { name: '수정', exact: true }).filter({ visible: true }).click();
  await expect(dialog).toContainText('소속: GEMINI');
  await expect(dialog.getByLabel('모델 식별자', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('일일 요청 제한', { exact: true }).fill('');
  await dialog.getByLabel('우선순위', { exact: true }).fill('1');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const update = state.requests.find(
    (request) => request.method === 'PUT' && request.path === '/api/ai/models/1',
  );
  expect(update?.body).toEqual({ priority: 1, rpdLimit: null, tpdLimit: null });
  expect(state.providers[0]?.models[0]?.model).toBe('gemini-2.5-flash');
});

test('empty providers, limited creation choices, loading error and retry', async ({ page }) => {
  const state = await installFixture(page);
  state.providers.splice(0);
  state.fail = 'GET /api/ai/providers';
  await page.goto('/providers');
  await expect(page.getByRole('heading', { name: '불러오지 못했어요' })).toBeVisible();
  state.fail = '';
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('heading', { name: '등록된 제공자가 없어요' })).toBeVisible();
  await page.getByRole('button', { name: '제공자 추가' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('업체')).toBeFocused();
  await dialog.getByLabel('업체').selectOption('CLAUDE');
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page).toHaveURL(/\/providers\/50$/);
  await expect(page.getByRole('button', { name: '제공자 활성화' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.getByRole('button', { name: '제공자 추가' }).click();
  await expect(dialog.getByLabel('업체').locator('option')).toHaveCount(2);
  await dialog.getByRole('button', { name: '취소' }).click();
});
