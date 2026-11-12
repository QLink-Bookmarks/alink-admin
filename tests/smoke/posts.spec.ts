import { expect, test } from '@playwright/test';
import { installFixture } from '../fixtures/setup';

test('announcements paginate, search Korean input, clear empty results, and show compatible content', async ({
  page,
}) => {
  await installFixture(page);
  await page.goto('/announcements');
  await expect(page.getByRole('link', { name: '공지 17', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '더 보기' }).click();
  await expect(page.getByRole('link', { name: '공지 1', exact: true })).toBeVisible();
  const search = page.getByLabel('제목 검색');
  await search.fill('없는 검색어');
  await expect(
    page.getByRole('heading', { name: '“없는 검색어” 검색 결과가 없어요' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '검색 지우기' }).first().click();
  await expect(search).toHaveValue('');
  await search.dispatchEvent('compositionstart');
  await search.fill('공지 17');
  await search.dispatchEvent('compositionend');
  await expect(page).toHaveURL(/query=/);
  await expect(page.getByRole('link', { name: '공지 17', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '공지 17', exact: true }).click();
  await expect(page).toHaveURL(/\/announcements\/20$/);
  await expect(page.getByText('첫 번째 줄\n두 번째 줄', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ALink 열기' })).toHaveAttribute(
    'href',
    'https://example.com',
  );
  await expect(page.getByRole('img', { name: '이미지를 불러올 수 없어요' })).toBeVisible();
  await page.goBack();
  await expect(search).toHaveValue('공지 17');
});

test('ordinary body links keep link semantics, text selection and 40px targets across post views', async ({
  page,
}) => {
  const state = await installFixture(page);
  const feedback = state.posts.find((post) => post.id === 100)!;
  feedback.contents = '피드백 본문\n[link:도움말|https://example.com/help]';

  const verifyBodyLink = async (container: import('@playwright/test').Locator) => {
    const link = container.getByRole('link', { name: '도움말', exact: true });
    await expect(link).toHaveAttribute('href', 'https://example.com/help');
    const result = await link.evaluate((element) => {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return {
        tagName: element.tagName,
        height: element.getBoundingClientRect().height,
        selected: selection?.toString(),
        userSelect: getComputedStyle(element).userSelect,
      };
    });
    expect(result.tagName).toBe('A');
    expect(result.height).toBeGreaterThanOrEqual(40);
    expect(result.selected).toBe('도움말');
    expect(result.userSelect).not.toBe('none');
  };

  await page.goto('/announcements/20');
  await verifyBodyLink(page.locator('.post-content'));

  await page.goto('/announcements/20/edit');
  if ((page.viewportSize()?.width ?? 1280) <= 768) {
    await page.getByRole('tab', { name: '미리보기' }).click();
  }
  await verifyBodyLink(page.getByRole('tabpanel', { name: '미리보기' }));

  await page.goto('/feedbacks/100');
  await verifyBodyLink(page.locator('.post-content'));
});

test('editor validates, inserts links/images, preserves leave cancellation and creates exactly once', async ({
  page,
}) => {
  const state = await installFixture(page);
  await page.goto('/announcements/new');
  const save = page.getByRole('button', { name: '등록하고 알림 보내기' });
  await save.click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('본문', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('제목', { exact: true }).fill(' '.repeat(3));
  await save.click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('제목', { exact: true }).fill('가'.repeat(101));
  await save.click();
  await expect(page.getByText('제목은 100자까지 입력해 주세요')).toBeVisible();
  await expect(page.getByText('101 / 100자', { exact: true })).toBeVisible();
  await page.getByLabel('제목', { exact: true }).fill('새 공지 한글');
  await page.getByLabel('본문', { exact: true }).fill('새 본문\n두 번째 줄');
  await page.getByRole('button', { name: '버튼 삽입', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('라벨')).toBeFocused();
  await dialog.getByRole('button', { name: '삽입', exact: true }).click();
  await expect(dialog.getByLabel('라벨')).toHaveAttribute('aria-invalid', 'true');
  await dialog.getByLabel('라벨').fill('열기');
  await dialog.getByLabel('주소').fill('javascript:evil');
  await dialog.getByRole('button', { name: '삽입', exact: true }).click();
  await expect(dialog.getByLabel('주소')).toHaveAttribute('aria-invalid', 'true');
  await dialog.getByLabel('주소').fill('https://example.com');
  await dialog.getByRole('button', { name: '삽입', exact: true }).click();
  await page
    .getByLabel('이미지 삽입', { exact: true })
    .setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('text') });
  await expect(
    page.getByRole('alert').filter({ hasText: '이미지를 삽입하지 못했어요' }),
  ).toBeVisible();
  state.delay = 300;
  await page
    .getByLabel('이미지 삽입', { exact: true })
    .setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('fixture-image') });
  await expect(page.getByText('이미지 업로드 중이에요…')).toBeVisible();
  await expect(page.getByLabel('본문', { exact: true })).toHaveValue(
    /\[img:https:\/\/fixture.test\/uploaded.png\]/,
  );
  state.delay = 0;
  await page.getByRole('link', { name: '피드백', exact: true }).click();
  await expect(dialog).toContainText('작성 중인 내용을 두고 나갈까요');
  await expect(dialog.getByRole('button', { name: '취소' })).toBeFocused();
  await dialog.getByRole('button', { name: '취소' }).click();
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue('새 공지 한글');
  if ((page.viewportSize()?.width ?? 1280) <= 768) {
    await page.getByRole('tab', { name: '미리보기' }).click();
    await expect(page.getByRole('tabpanel', { name: '미리보기' })).toBeVisible();
    await page.getByRole('tab', { name: '작성', exact: true }).click();
  }
  state.delay = 350;
  await save.click();
  await expect(page.getByRole('button', { name: '저장 중…' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/announcements\/500$/);
  await expect(page.getByRole('status')).toContainText('저장했어요');
  expect(
    state.requests.filter((request) => request.method === 'POST' && request.path === '/api/posts'),
  ).toHaveLength(1);
  expect(
    state.requests.find((request) => request.method === 'POST' && request.path === '/api/posts')
      ?.body,
  ).toMatchObject({ type: 'ANNOUNCEMENT', imageUrls: [] });
});

test('unknown create result requires list check and preserves draft', async ({ page }) => {
  const state = await installFixture(page);
  await page.goto('/announcements/new');
  await page.getByLabel('제목', { exact: true }).fill('응답 없음');
  await page.getByLabel('본문', { exact: true }).fill('보존할 내용');
  state.fail = 'POST /api/posts';
  state.failStatus = 0;
  await page.getByRole('button', { name: '등록하고 알림 보내기' }).click();
  await expect(page.getByRole('heading', { name: '저장됐는지 확인할 수 없어요' })).toBeVisible();
  await expect(page.getByLabel('본문', { exact: true })).toHaveValue('보존할 내용');
  await expect(page.getByRole('link', { name: '목록 확인 (새 탭)' })).toHaveAttribute(
    'target',
    '_blank',
  );
  await expect(page.getByRole('button', { name: '등록하고 알림 보내기' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});

test('mobile preview returns to the body field for local and server blank-body errors', async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 1280) > 768);
  const state = await installFixture(page);
  await page.goto('/announcements/new');
  await page.getByLabel('제목', { exact: true }).fill('본문 오류 확인');
  await page.getByRole('tab', { name: '미리보기' }).click();
  await page.getByRole('button', { name: '등록하고 알림 보내기' }).click();
  await expect(page.getByRole('tabpanel', { name: '작성' })).toBeVisible();
  await expect(page.getByLabel('본문', { exact: true })).toBeFocused();
  await expect(page.getByText('본문을 입력해 주세요')).toBeVisible();

  await page.getByLabel('본문', { exact: true }).fill('서버에서 거절된 본문');
  await page.getByRole('tab', { name: '미리보기' }).click();
  state.fail = 'POST /api/posts';
  state.failStatus = 400;
  state.failCode = 'POST_400_0003';
  await page.getByRole('button', { name: '등록하고 알림 보내기' }).click();
  await expect(page.getByRole('tabpanel', { name: '작성' })).toBeVisible();
  await expect(page.getByLabel('본문', { exact: true })).toBeFocused();
  await expect(page.getByText('본문을 입력해 주세요')).toBeVisible();
});

test('edit network retry, immutable DTO, long contents warning, delete cancel and already deleted', async ({
  page,
}) => {
  const state = await installFixture(page);
  await page.goto('/announcements/20/edit');
  await expect(page.getByText('수정은 알림을 다시 보내지 않아요')).toBeVisible();
  await page.getByLabel('제목', { exact: true }).fill('수정한 공지');
  await page.getByLabel('본문', { exact: true }).fill('가'.repeat(10001));
  await expect(page.getByText('본문이 10,000자를 넘었어요.', { exact: false })).toBeVisible();
  state.fail = 'PUT /api/posts/20';
  state.failStatus = 0;
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('저장하지 못했어요');
  await expect(page.getByLabel('제목', { exact: true })).toHaveValue('수정한 공지');
  state.fail = '';
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page).toHaveURL(/\/announcements\/20$/);
  const update = state.requests.find(
    (request) => request.method === 'PUT' && request.path === '/api/posts/20',
  );
  expect(Object.keys(update!.body).sort()).toEqual(['contents', 'title']);
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('인앱 알림도 삭제');
  await expect(dialog).toContainText('푸시는 회수되지 않아요');
  await dialog.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('button', { name: '삭제', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await dialog.getByRole('button', { name: '삭제 확인' }).click();
  await expect(page).toHaveURL(/\/announcements$/);
  await page.goto('/announcements/20');
  await expect(page.getByRole('heading', { name: '이미 삭제됐어요' })).toBeVisible();
});

test('feedback pages paginate, search, retry errors and expose read-only detail with attachments', async ({
  page,
}) => {
  const state = await installFixture(page);
  state.fail = 'GET /api/posts';
  await page.goto('/feedbacks');
  await expect(page.getByRole('heading', { name: '불러오지 못했어요' })).toBeVisible();
  state.fail = '';
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('link', { name: '피드백 17', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '더 보기' }).click();
  await expect(page.getByRole('link', { name: '피드백 1', exact: true })).toBeVisible();
  await page.getByLabel('제목 검색').fill('없는 의견');
  await expect(page.getByRole('heading', { name: '“없는 의견” 검색 결과가 없어요' })).toBeVisible();
  await page.getByRole('button', { name: '검색 지우기' }).first().click();
  await page.getByRole('link', { name: '피드백 17', exact: true }).click();
  await expect(page.getByText('테스터 · 사용자 번호 10')).toBeVisible();
  await expect(page.getByRole('link', { name: '첨부 이미지 원본 열기 (새 탭)' })).toHaveAttribute(
    'target',
    '_blank',
  );
  await expect(page.getByRole('button', { name: /삭제|답변|처리/ })).toHaveCount(0);
  await page.goto('/feedbacks/101');
  await expect(page.getByRole('region', { name: '첨부 이미지' })).toHaveCount(0);
  state.posts.splice(0);
  await page.goto('/feedbacks');
  await expect(page.getByRole('heading', { name: '접수된 피드백이 없어요' })).toBeVisible();
  await page.goto('/announcements');
  await expect(page.getByRole('heading', { name: '아직 등록된 공지가 없어요' })).toBeVisible();
  await expect(page.getByRole('link', { name: '첫 공지 등록' })).toBeVisible();
});
