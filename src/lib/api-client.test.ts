import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api-client';
import { ApiError } from './api-error';
import { apiBaseUrl } from './server';

afterEach(() => vi.unstubAllGlobals());

describe('admin transport', () => {
  it('includes cookies, admin requester and per-request memory token', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"data":[]}'));
    vi.stubGlobal('fetch', fetcher);
    await expect(
      apiRequest('/api/ai/providers', { server: 'dev', accessToken: 'test-token' }),
    ).resolves.toEqual({
      data: [],
    });
    const options = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(options.credentials).toBe('include');
    expect(options.redirect).toBe('error');
    expect(new Headers(options.headers).get('Alink-Requester')).toBe('admin');
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-token');
    expect(new Headers(options.headers).has('csrf_token')).toBe(false);
  });

  it.each(['/api/auth/admin/token/refresh', '/api/auth/admin/signout'] as const)(
    'adds CSRF for %s and accepts empty responses',
    async (path) => {
      const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
      vi.stubGlobal('fetch', fetcher);
      await expect(apiRequest(path, { server: 'dev' })).resolves.toBeUndefined();
      const options = fetcher.mock.calls[0]?.[1] as RequestInit;
      expect(new Headers(options.headers).get('csrf_token')).toMatch(/^[\da-f-]{36}$/);
    },
  );

  it('does not expose server errors or credentials in user feedback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('sensitive server detail', { status: 500 })),
    );
    await expect(apiRequest('/api/users/me', { server: 'dev' })).rejects.toThrow(
      '요청을 완료하지 못했어요',
    );
  });

  it('makes network failures recoverable with safe feedback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sensitive proxy information')));
    await expect(apiRequest('/api/users/me', { server: 'dev' })).rejects.toThrow(
      '다시 시도해 주세요',
    );
  });

  it('hides malformed upstream response details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('sensitive malformed response')));
    await expect(apiRequest('/api/users/me', { server: 'dev' })).rejects.toThrow(
      '요청을 완료하지 못했어요',
    );
  });

  it('normalizes body stream failures after fetch succeeds', async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new Error('synthetic upstream body failure detail'));
        },
      }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    const result = apiRequest('/api/users/me', { server: 'dev' });
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      status: 0,
      message: '요청을 완료하지 못했어요. 다시 시도해 주세요',
    });
  });

  it('preserves request cancellation while reading the response body', async () => {
    const controller = new AbortController();
    const cancellation = new DOMException('Request cancelled', 'AbortError');
    const response = new Response();
    vi.spyOn(response, 'text').mockImplementation(async () => {
      controller.abort();
      throw cancellation;
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(
      apiRequest('/api/users/me', { server: 'dev', signal: controller.signal }),
    ).rejects.toBe(cancellation);
  });

  it.each(['dev', 'prod'] as const)(
    'sends %s requests to that server base URL only',
    async (server) => {
      const fetcher = vi.fn().mockResolvedValue(new Response('{"data":[]}'));
      vi.stubGlobal('fetch', fetcher);
      await apiRequest('/api/posts?type=FEEDBACK', { server });
      expect(fetcher.mock.calls[0]?.[0]).toBe(`${apiBaseUrl(server)}/api/posts?type=FEEDBACK`);
      expect(apiBaseUrl('dev')).not.toBe(apiBaseUrl('prod'));
    },
  );

  it('ends an unanswered request at the response limit as a connection failure', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            signal = init.signal ?? undefined;
            signal?.addEventListener('abort', () => reject(signal?.reason));
          }),
      ),
    );
    const result = apiRequest('/api/auth/admin/sign', { server: 'prod', timeout: 15_000 });
    const outcome = expect(result).rejects.toMatchObject({ name: 'ApiError', status: 0 });
    await vi.advanceTimersByTimeAsync(14_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await outcome;
    vi.useRealTimers();
  });

  it('forwards caller cancellation to the request and keeps it a cancellation', async () => {
    const controller = new AbortController();
    const cancellation = new DOMException('Request cancelled', 'AbortError');
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            signal = init.signal ?? undefined;
            signal?.addEventListener('abort', () => reject(cancellation));
          }),
      ),
    );
    const result = apiRequest('/api/posts', {
      server: 'dev',
      signal: controller.signal,
      timeout: 15_000,
    });
    controller.abort();
    await expect(result).rejects.toBe(cancellation);
    expect(signal?.aborted).toBe(true);
  });

  it('rejects traversal before sending an authorization token', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      apiRequest('/api/../outside', { server: 'dev', accessToken: 'test-token' }),
    ).rejects.toThrow('올바른 API 경로');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
