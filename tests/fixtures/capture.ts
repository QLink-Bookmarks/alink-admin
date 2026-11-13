import { createFixture, gisStub, handleFixture } from './admin-api';

const state = createFixture();
const params = new URL(location.href).searchParams;
const scenario = params.get('capture') ?? '';
const server = params.get('server') === 'prod' ? 'prod' : 'dev';
if (params.has('server')) localStorage.setItem('alink-admin:last-server', server);
if (scenario.startsWith('login') && scenario !== 'login-expired') {
  state.sessions.dev = false;
  state.sessions.prod = false;
}
if (scenario === 'login-pending') state.hang = 'POST /api/auth/admin/sign';
if (scenario === 'login-forbidden') state.signForbidden = true;
if (scenario === 'login-failed') {
  state.fail = 'POST /api/auth/admin/sign';
  state.failStatus = 401;
  state.failCode = 'AUTH_401_0002';
}
if (scenario === 'login-offline') state.offline = [server];
if (scenario === 'login-expired') state.expireOnData = true;
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
window.eval(gisStub);
window.fetch = async (input, init = {}) => {
  const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (scenario === 'loading' && path.includes('/api/posts')) return new Promise(() => {});
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  const body =
    typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
  const result = await handleFixture(state, init.method ?? 'GET', path, body, headers);
  if (result.abort) throw new TypeError('Failed to fetch');
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
  'login-failed': 'Google로 로그인',
  'login-pending': 'Google로 로그인',
  'header-account': '계정',
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
