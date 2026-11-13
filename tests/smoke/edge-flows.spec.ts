import { expect, test } from '@playwright/test';
import { installFixture } from '../fixtures/setup';

test('no Google callback leaves login usable, repeated callbacks submit once', async ({ page }) => {
  const state = await installFixture(page);
  state.sessions.dev = false;
  await page.goto('/login');
  const button = page.getByRole('button', { name: 'Google로 로그인' });
  await expect(button).toBeVisible();
  await page.evaluate(() => {
    const fixture = window as Window & {
      fixtureCredential?: () => void;
      savedCallback?: () => void;
    };
    fixture.savedCallback = fixture.fixtureCredential;
    fixture.fixtureCredential = () => {};
  });
  await button.click();
  await expect(button).toBeVisible();
  expect(state.requests.filter((request) => request.path === '/api/auth/admin/sign')).toHaveLength(
    0,
  );
  state.delay = 250;
  await page.evaluate(() => {
    const fixture = window as Window & { savedCallback?: () => void };
    fixture.savedCallback?.();
    fixture.savedCallback?.();
  });
  await expect(page).toHaveURL(/\/providers$/);
  expect(state.requests.filter((request) => request.path === '/api/auth/admin/sign')).toHaveLength(
    1,
  );
});

test('two editors send immutable fields and latest saves are visible after reload', async ({
  page,
}) => {
  const state = await installFixture(page);
  const second = await page.context().newPage();
  await installFixture(second, state);
  for (const tab of [page, second]) {
    await tab.goto('/announcements/20/edit');
    await expect(tab.getByLabel('제목', { exact: true })).toBeVisible();
  }
  await page.getByLabel('제목', { exact: true }).fill('먼저 저장');
  await second.getByLabel('제목', { exact: true }).fill('나중 저장');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page).toHaveURL(/\/announcements\/20$/);
  await second.getByRole('button', { name: '저장', exact: true }).click();
  await expect(second).toHaveURL(/\/announcements\/20$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: '나중 저장', exact: true })).toBeVisible();
  for (const tab of [page, second]) {
    await tab.goto('/providers/1');
    await tab.getByLabel('gemini-2.5-flash 행 메뉴').filter({ visible: true }).click();
    await tab.getByRole('button', { name: '수정', exact: true }).filter({ visible: true }).click();
  }
  await page.getByRole('dialog').getByLabel('우선순위', { exact: true }).fill('2');
  await second.getByRole('dialog').getByLabel('우선순위', { exact: true }).fill('3');
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await second.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await expect(second.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('기본 URL')).toBeVisible();
  expect(state.providers[0]!.models[0]).toMatchObject({
    id: 1,
    model: 'gemini-2.5-flash',
    priority: 3,
  });
  for (const request of state.requests.filter(
    (request) => request.method === 'PUT' && request.path === '/api/ai/models/1',
  ))
    expect(Object.keys(request.body).sort()).toEqual(['priority', 'rpdLimit', 'tpdLimit']);
  await second.close();
});

test('upload failure keeps content, a long title truncates only in lists, and browser back can cancel', async ({
  page,
}) => {
  const state = await installFixture(page);
  const title = '긴 제목'.repeat(24);
  state.posts[0]!.title = title;
  await page.goto('/announcements');
  const link = page.getByRole('link', { name: title, exact: true });
  await expect(link).toHaveAttribute('title', title);
  expect(await link.evaluate((element) => getComputedStyle(element).textOverflow)).toBe('ellipsis');
  await link.click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('link', { name: '수정', exact: true }).click();
  const contents = page.getByLabel('본문', { exact: true });
  const original = await contents.inputValue();
  state.fail = 'POST /api/images';
  await page
    .getByLabel('이미지 삽입', { exact: true })
    .setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
  await expect(page.getByRole('alert')).toContainText('이미지를 삽입하지 못했어요');
  await expect(contents).toHaveValue(original);
  await contents.fill('보존할 편집 내용');
  await page.goBack();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('작성 중인 내용을 두고 나갈까요');
  await dialog.getByRole('button', { name: '취소' }).click();
  await expect(contents).toHaveValue('보존할 편집 내용');
});

test('concurrent deletion removes models from the list and announces missing announcements', async ({
  page,
}) => {
  const state = await installFixture(page);
  await page.goto('/providers/1');
  await page.getByLabel('gemini-2.5-flash 행 메뉴').filter({ visible: true }).click();
  await page.getByRole('button', { name: '수정', exact: true }).filter({ visible: true }).click();
  state.providers[0]!.models.shift();
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('이미 삭제됐어요');
  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click();
  await expect(page.getByLabel('gemini-2.5-flash 행 메뉴')).toHaveCount(0);
  await page.goto('/announcements/20');
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  state.posts.splice(
    state.posts.findIndex((post) => post.id === 20),
    1,
  );
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page).toHaveURL(/\/announcements$/);
  await expect(page.getByRole('status')).toContainText('이미 삭제됐어요');
});
