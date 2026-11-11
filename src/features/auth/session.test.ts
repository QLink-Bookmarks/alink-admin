import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const success = (data: unknown) => new Response(JSON.stringify({ success: true, data }));
const failure = (status: number, code: string) =>
  new Response(JSON.stringify({ success: false, error: { code, message: 'secret detail' } }), {
    status,
  });
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe('admin session boundaries', () => {
  it('coalesces concurrent refresh and retries each request once with the new memory token', async () => {
    let refreshes = 0;
    const fetcher = vi.fn(async (path: string, options: RequestInit) => {
      if (path.includes('/token/refresh')) {
        refreshes++;
        return success({ accessToken: `token-${refreshes}` });
      }
      if (path === '/api/users/me') return success({ nickname: '관리자', role: 'ADMIN' });
      if (new Headers(options.headers).get('Authorization') === 'Bearer token-1')
        return failure(401, 'AUTH_401_0001');
      return success(['latest']);
    });
    vi.stubGlobal('fetch', fetcher);
    const { session } = await import('./session');
    await session.bootstrap();
    await expect(
      Promise.all([session.request('/api/ai/providers'), session.request('/api/posts')]),
    ).resolves.toEqual([['latest'], ['latest']]);
    expect(refreshes).toBe(2);
    expect(session.getSnapshot().status).toBe('authenticated');
  });
  it.each(['AI_403_0002', 'POST_403_0002', 'AI_404_0004', 'POST_404_0003'])(
    'clears sensitive data immediately for %s',
    async (code) => {
      const clear = vi.fn();
      vi.stubGlobal(
        'fetch',
        vi.fn(async (path: string) =>
          path.includes('refresh')
            ? success({ accessToken: 'private-token' })
            : path === '/api/users/me'
              ? success({ nickname: '관리자', role: 'SUPER_ADMIN' })
              : path.includes('signout')
                ? success(null)
                : failure(code.includes('404') ? 404 : 403, code),
        ),
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
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) =>
        path.includes('refresh')
          ? success({ accessToken: 'private-token' })
          : path === '/api/users/me'
            ? success({ nickname: '관리자', role: 'ADMIN' })
            : path.includes('signout')
              ? success(null)
              : new Promise<Response>((resolve) => {
                  finish = resolve;
                }),
      ),
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
