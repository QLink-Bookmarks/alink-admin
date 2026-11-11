import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api-client';
import { ApiError } from './api-error';

afterEach(() => vi.unstubAllGlobals());

describe('admin transport', () => {
  it('includes cookies, admin requester and per-request memory token', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"data":[]}'));
    vi.stubGlobal('fetch', fetcher);
    await expect(apiRequest('/api/ai/providers', { accessToken: 'test-token' })).resolves.toEqual({
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
      await expect(apiRequest(path)).resolves.toBeUndefined();
      const options = fetcher.mock.calls[0]?.[1] as RequestInit;
      expect(new Headers(options.headers).get('csrf_token')).toMatch(/^[\da-f-]{36}$/);
    },
  );

  it('does not expose server errors or credentials in user feedback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('sensitive server detail', { status: 500 })),
    );
    await expect(apiRequest('/api/users/me')).rejects.toThrow('요청을 완료하지 못했어요');
  });

  it('makes network failures recoverable with safe feedback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sensitive proxy information')));
    await expect(apiRequest('/api/users/me')).rejects.toThrow('다시 시도해 주세요');
  });

  it('hides malformed upstream response details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('sensitive malformed response')));
    await expect(apiRequest('/api/users/me')).rejects.toThrow('요청을 완료하지 못했어요');
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
    const result = apiRequest('/api/users/me');
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
    await expect(apiRequest('/api/users/me', { signal: controller.signal })).rejects.toBe(
      cancellation,
    );
  });

  it('rejects traversal before sending an authorization token', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(apiRequest('/api/../outside', { accessToken: 'test-token' })).rejects.toThrow(
      '올바른 API 경로',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
