import { createFixture, gisStub, handleFixture } from './admin-api';

const state = createFixture();
const scenario = new URL(location.href).searchParams.get('capture') ?? '';
if (scenario.startsWith('login')) state.authenticated = false;
if (scenario === 'denied') state.deny = true;
if (scenario === 'empty') {
  state.providers.splice(0);
  state.posts.splice(0);
}
if (scenario === 'error') {
  state.fail = 'GET /api/posts';
  state.failStatus = 500;
}
if (scenario === 'inactive') state.providers[0]!.isActive = false;
if (scenario === 'login-forbidden') state.signForbidden = true;
window.eval(gisStub);
window.fetch = async (input, init = {}) => {
  const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (scenario === 'loading' && path.startsWith('/api/posts')) return new Promise(() => {});
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  const body =
    typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
  const result = await handleFixture(state, init.method ?? 'GET', path, body, headers);
  return new Response(
    JSON.stringify(
      result.code
        ? { success: false, error: { code: result.code } }
        : { success: true, data: result.data },
    ),
    { status: result.status, headers: { 'Content-Type': 'application/json' } },
  );
};
const targets: Record<string, string> = {
  'model-form': '모델 추가',
  confirm: '제공자 비활성화',
  delete: '삭제',
  'login-forbidden': 'Google로 로그인',
};
const target = targets[scenario];
if (target) {
  const observer = new MutationObserver(() => {
    const button = [...document.querySelectorAll('button')].find(
      (element) => element.textContent === target,
    );
    if (button) {
      observer.disconnect();
      button.click();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
