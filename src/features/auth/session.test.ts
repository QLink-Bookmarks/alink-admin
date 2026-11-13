import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl, type ServerId } from '../../lib/server';

const success = (data: unknown) => new Response(JSON.stringify({ success: true, data }));
const failure = (status: number, code: string) =>
  new Response(JSON.stringify({ success: false, error: { code, message: 'secret detail' } }), {
    status,
  });
const route = (url: string) => url.slice(url.indexOf('/api/'));
const serverOf = (url: string): ServerId =>
  url.startsWith(`${apiBaseUrl('prod')}/`) ? 'prod' : 'dev';
const storage = (initial?: string) => {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set('alink-admin:last-server', initial);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  });
  return values;
};
type Handler = (
  path: string,
  server: ServerId,
  options: RequestInit,
) => Response | Promise<Response>;
const serve = (handler: Handler) => {
  const fetcher = vi.fn(async (url: string, options: RequestInit) =>
    handler(route(url), serverOf(url), options),
  );
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
};
const admin = (path: string) =>
  path.includes('/token/refresh') || path.endsWith('/sign')
    ? success({ accessToken: 'private-token' })
    : path === '/api/users/me'
      ? success({ nickname: '관리자', role: 'ADMIN' })
      : success(null);
const offline = () => Promise.reject(new TypeError('Failed to fetch'));
const calls = (fetcher: ReturnType<typeof serve>) =>
  fetcher.mock.calls.map(([url]) => `${serverOf(url)} ${route(url)}`);
beforeEach(() => {
  vi.resetModules();
  storage();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('admin session boundaries', () => {
  it('coalesces concurrent refresh and retries each request once with the new memory token', async () => {
    let refreshes = 0;
    serve((path, _server, options) => {
      if (path.includes('/token/refresh')) {
        refreshes++;
        return success({ accessToken: `token-${refreshes}` });
      }
      if (path === '/api/users/me') return success({ nickname: '관리자', role: 'ADMIN' });
      if (new Headers(options.headers).get('Authorization') === 'Bearer token-1')
        return failure(401, 'AUTH_401_0001');
      return success(['latest']);
    });
    const { session } = await import('./session');
    await session.bootstrap();
    await expect(
      Promise.all([session.request('/api/ai/providers'), session.request('/api/posts')]),
    ).resolves.toEqual([['latest'], ['latest']]);
    expect(refreshes).toBe(2);
    expect(session.getSnapshot().status).toBe('authenticated');
  });
  it.each(['AI_403_0002', 'POST_403_0002', 'AI_404_0004', 'POST_404_0003', 'POST_404_0001'])(
    'clears sensitive data immediately for %s',
    async (code) => {
      const clear = vi.fn();
      serve((path) =>
        path.includes('refresh')
          ? success({ accessToken: 'private-token' })
          : path === '/api/users/me'
            ? success({ nickname: '관리자', role: 'SUPER_ADMIN' })
            : path.includes('signout')
              ? success(null)
              : failure(code.includes('404') ? 404 : 403, code),
      );
      const { session } = await import('./session');
      session.setCacheClearer(clear);
      await session.bootstrap();
      await expect(session.request('/api/ai/providers')).rejects.toThrow();
      expect(clear).toHaveBeenCalledOnce();
      expect(session.getSnapshot().status).toBe('denied');
    },
  );
  it('prevents a late successful request from restoring data after logout', async () => {
    let finish: (response: Response) => void = () => {};
    serve((path) =>
      path === '/api/ai/providers'
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : admin(path),
    );
    const { session } = await import('./session');
    await session.bootstrap();
    const pending = session.request('/api/ai/providers');
    await session.logout();
    finish(success(['sensitive']));
    await expect(pending).rejects.toThrow();
    expect(session.getSnapshot().status).toBe('guest');
  });
});

describe('server selection in the session', () => {
  it('restores only the last server and keeps every request on it', async () => {
    storage('prod');
    const fetcher = serve(admin);
    const { session } = await import('./session');
    await session.bootstrap();
    expect(session.getSnapshot()).toMatchObject({ status: 'authenticated', server: 'prod' });
    await session.request('/api/posts?type=FEEDBACK');
    await session.logout();
    expect(calls(fetcher)).toEqual([
      'prod /api/auth/admin/token/refresh',
      'prod /api/users/me',
      'prod /api/posts?type=FEEDBACK',
      'prod /api/auth/admin/signout',
    ]);
    expect(session.getSnapshot()).toMatchObject({ status: 'guest', server: 'prod' });
    expect(session.getSnapshot().notice).toBeUndefined();
  });

  it('opens the last server login without a notice when its session is missing', async () => {
    storage('prod');
    const fetcher = serve(() => failure(401, 'AUTH_401_0001'));
    const { session } = await import('./session');
    await session.bootstrap();
    expect(session.getSnapshot()).toEqual({ status: 'guest', server: 'prod' });
    expect(calls(fetcher)).toEqual(['prod /api/auth/admin/token/refresh']);
  });

  it('changing the selection sends nothing and stores nothing', async () => {
    const values = storage('prod');
    const fetcher = serve(() => failure(401, 'AUTH_401_0001'));
    const { session } = await import('./session');
    await session.bootstrap();
    fetcher.mockClear();
    session.select('dev');
    expect(session.getSnapshot()).toEqual({ status: 'guest', server: 'dev' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(values.get('alink-admin:last-server')).toBe('prod');
  });

  it('signs in to the selected server only and remembers it after success', async () => {
    const values = storage();
    const clear = vi.fn();
    const fetcher = serve((path) =>
      path.includes('/token/refresh') ? failure(401, 'AUTH_401_0001') : admin(path),
    );
    const { session } = await import('./session');
    session.setCacheClearer(clear);
    await session.bootstrap();
    session.select('prod');
    clear.mockClear();
    fetcher.mockClear();
    await session.login('google-credential');
    expect(session.getSnapshot()).toMatchObject({ status: 'authenticated', server: 'prod' });
    expect(calls(fetcher)).toEqual(['prod /api/auth/admin/sign', 'prod /api/users/me']);
    expect(clear).toHaveBeenCalled();
    expect([...values]).toEqual([['alink-admin:last-server', 'prod']]);
  });

  it('locks the selection and ignores a second sign-in while one is pending', async () => {
    let finish: (response: Response) => void = () => {};
    const fetcher = serve((path) =>
      path.endsWith('/sign')
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : path.includes('/token/refresh')
          ? failure(401, 'AUTH_401_0001')
          : admin(path),
    );
    const { session } = await import('./session');
    await session.bootstrap();
    session.select('prod');
    const first = session.login('first');
    const second = session.login('second');
    await vi.waitFor(() => expect(session.getSnapshot().pending).toBe(true));
    session.select('dev');
    expect(session.getSnapshot()).toMatchObject({ server: 'prod', pending: true });
    finish(success({ accessToken: 'private-token' }));
    await Promise.all([first, second]);
    expect(calls(fetcher).filter((call) => call.endsWith('/sign'))).toEqual([
      'prod /api/auth/admin/sign',
    ]);
  });

  it.each([
    [403, 'AUTH_403_0002', 'forbidden'],
    [401, 'AUTH_401_0002', 'failed'],
  ] as const)('keeps the server and shows %s sign-in rejection', async (status, code, notice) => {
    const values = storage();
    serve((path) =>
      path.endsWith('/sign')
        ? failure(status, code)
        : path.includes('/token/refresh')
          ? failure(401, 'AUTH_401_0001')
          : admin(path),
    );
    const { session } = await import('./session');
    await session.bootstrap();
    session.select('prod');
    await session.login('google-credential');
    expect(session.getSnapshot()).toEqual({ status: 'guest', server: 'prod', notice });
    expect(values.size).toBe(0);
    await session.retry();
    expect(session.getSnapshot().notice).toBe(notice);
  });

  it('treats a non-admin profile at sign-in as not an admin of that server', async () => {
    const fetcher = serve((path) =>
      path === '/api/users/me'
        ? success({ nickname: '사용자', role: 'USER' })
        : path.includes('/token/refresh')
          ? failure(401, 'AUTH_401_0001')
          : admin(path),
    );
    const { session } = await import('./session');
    await session.bootstrap();
    await session.login('google-credential');
    expect(session.getSnapshot()).toEqual({ status: 'guest', server: 'dev', notice: 'forbidden' });
    await vi.waitFor(() => expect(calls(fetcher)).toContain('dev /api/auth/admin/signout'));
  });

  it('retries an offline sign-in with the same credential on the same server', async () => {
    let online = false;
    const bodies: unknown[] = [];
    serve((path, _server, options) => {
      if (path.endsWith('/sign')) {
        bodies.push(JSON.parse(String(options.body)));
        if (!online) return offline();
      }
      return path.includes('/token/refresh') ? failure(401, 'AUTH_401_0001') : admin(path);
    });
    const { session } = await import('./session');
    await session.bootstrap();
    session.select('prod');
    await session.login('google-credential');
    expect(session.getSnapshot()).toEqual({ status: 'guest', server: 'prod', notice: 'offline' });
    online = true;
    await session.retry();
    expect(session.getSnapshot()).toMatchObject({ status: 'authenticated', server: 'prod' });
    expect(bodies).toEqual([
      { provider: 'GOOGLE', token: 'google-credential' },
      { provider: 'GOOGLE', token: 'google-credential' },
    ]);
  });

  it('ends a sign-in that gets no answer in 15 seconds as a connection failure', async () => {
    vi.useFakeTimers();
    serve((path, _server, options) =>
      path.endsWith('/sign')
        ? new Promise<Response>((_resolve, reject) =>
            options.signal?.addEventListener('abort', () => reject(options.signal?.reason)),
          )
        : path.includes('/token/refresh')
          ? failure(401, 'AUTH_401_0001')
          : admin(path),
    );
    const { session, responseLimit } = await import('./session');
    await session.bootstrap();
    session.select('prod');
    const login = session.login('google-credential');
    await vi.advanceTimersByTimeAsync(responseLimit - 1);
    expect(session.getSnapshot().pending).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await login;
    expect(responseLimit).toBe(15_000);
    expect(session.getSnapshot()).toEqual({ status: 'guest', server: 'prod', notice: 'offline' });
    session.select('dev');
    expect(session.getSnapshot()).toEqual({ status: 'guest', server: 'dev' });
  });

  it('shows an offline start on the last server and retries the restore without signing in', async () => {
    storage('prod');
    let online = false;
    const fetcher = serve((path) => (online ? admin(path) : offline()));
    const { session } = await import('./session');
    await session.bootstrap();
    expect(session.getSnapshot()).toEqual({ status: 'guest', server: 'prod', notice: 'offline' });
    online = true;
    await session.retry();
    expect(session.getSnapshot()).toMatchObject({ status: 'authenticated', server: 'prod' });
    expect(calls(fetcher)).toEqual([
      'prod /api/auth/admin/token/refresh',
      'prod /api/auth/admin/token/refresh',
      'prod /api/users/me',
    ]);
  });

  it('returns to the same server login with an expiry notice when the session ends in use', async () => {
    let signedIn = true;
    serve((path) =>
      path.includes('/token/refresh') && !signedIn
        ? failure(401, 'AUTH_401_0001')
        : path === '/api/ai/providers'
          ? failure(401, 'AUTH_401_0001')
          : admin(path),
    );
    const { session } = await import('./session');
    await session.bootstrap();
    signedIn = false;
    await expect(session.request('/api/ai/providers')).rejects.toThrow();
    expect(session.getSnapshot()).toEqual({ status: 'guest', server: 'dev', notice: 'expired' });
  });

  it('shows a connection failure, not an expiry, when a refresh in use cannot reach the server', async () => {
    storage('prod');
    let online = true;
    let refreshes = 0;
    serve((path) => {
      if (path.includes('/token/refresh')) refreshes++;
      if (path.includes('/token/refresh') && refreshes > 1 && !online) return offline();
      return path === '/api/ai/providers' && refreshes === 1
        ? failure(401, 'AUTH_401_0001')
        : admin(path);
    });
    const { session } = await import('./session');
    await session.bootstrap();
    online = false;
    await expect(session.request('/api/ai/providers')).rejects.toThrow();
    expect(session.getSnapshot()).toEqual({ status: 'guest', server: 'prod', notice: 'offline' });
    online = true;
    await session.retry();
    expect(session.getSnapshot()).toMatchObject({ status: 'authenticated', server: 'prod' });
  });

  it('keeps the denied screen on the session server', async () => {
    storage('prod');
    serve((path) => (path === '/api/ai/providers' ? failure(403, 'AI_403_0002') : admin(path)));
    const { session } = await import('./session');
    await session.bootstrap();
    await expect(session.request('/api/ai/providers')).rejects.toThrow();
    expect(session.getSnapshot()).toEqual({ status: 'denied', server: 'prod' });
    await session.logout();
    expect(session.getSnapshot()).toEqual({ status: 'guest', server: 'prod' });
  });

  it('reports a failed logout for the current server and retries it there', async () => {
    storage('prod');
    let fail = true;
    const fetcher = serve((path) =>
      path.endsWith('/signout') && fail ? failure(500, 'COMMON_500_0001') : admin(path),
    );
    const { session } = await import('./session');
    await session.bootstrap();
    await session.logout();
    expect(session.getSnapshot()).toEqual({
      status: 'guest',
      server: 'prod',
      notice: 'logout-failed',
    });
    fail = false;
    await session.logout();
    expect(session.getSnapshot()).toEqual({ status: 'guest', server: 'prod' });
    expect(calls(fetcher).every((call) => call.startsWith('prod '))).toBe(true);
  });

  it('drops a late response from the previous server after switching servers', async () => {
    let finish: (response: Response) => void = () => {};
    const fetcher = serve((path, server) =>
      server === 'dev' && path === '/api/posts?type=ANNOUNCEMENT'
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : admin(path),
    );
    const { session } = await import('./session');
    await session.bootstrap();
    const late = session.request('/api/posts?type=ANNOUNCEMENT');
    await session.logout();
    session.select('prod');
    await session.login('google-credential');
    finish(success({ contents: ['dev data'] }));
    await expect(late).rejects.toThrow();
    expect(session.getSnapshot()).toMatchObject({ status: 'authenticated', server: 'prod' });
    await expect(session.request('/api/posts?type=ANNOUNCEMENT')).resolves.toBeNull();
    expect(calls(fetcher).slice(-1)).toEqual(['prod /api/posts?type=ANNOUNCEMENT']);
  });
});
