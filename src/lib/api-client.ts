import { ApiError } from './api-error';
import { apiBaseUrl, type ServerId } from './server';

type ApiPath = `/api/${string}`;
type ApiOptions = Omit<RequestInit, 'credentials' | 'redirect'> & {
  server: ServerId;
  accessToken?: string;
  timeout?: number;
};

const csrfPaths = new Set(['/api/auth/admin/token/refresh', '/api/auth/admin/signout']);

export async function apiRequest<T>(path: ApiPath, options: ApiOptions): Promise<T> {
  if (!path.startsWith('/api/') || path.includes('\\') || /[\r\n]/.test(path)) {
    throw new Error('올바른 API 경로가 아니에요');
  }
  const url = new URL(path, 'https://admin.invalid');
  if (url.origin !== 'https://admin.invalid' || !url.pathname.startsWith('/api/')) {
    throw new Error('올바른 API 경로가 아니에요');
  }
  const { accessToken, server, timeout, ...requestOptions } = options;
  const headers = new Headers(options.headers);
  headers.set('Alink-Requester', 'admin');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (csrfPaths.has(url.pathname)) headers.set('csrf_token', crypto.randomUUID());
  const timer = new AbortController();
  const timeoutId = timeout ? setTimeout(() => timer.abort(), timeout) : undefined;
  const signal = options.signal ? AbortSignal.any([options.signal, timer.signal]) : timer.signal;
  try {
    return await send<T>(
      `${apiBaseUrl(server)}${path}`,
      { ...requestOptions, headers, signal, credentials: 'include', redirect: 'error' },
      () => options.signal?.aborted === true,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function send<T>(url: string, init: RequestInit, cancelled: () => boolean): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    if (cancelled()) throw cause;
    throw new ApiError(0);
  }
  if (!response.ok) {
    let code = '';
    try {
      const body = (await response.json()) as { code?: unknown; error?: { code?: unknown } };
      const value = body.code ?? body.error?.code;
      if (typeof value === 'string') code = value;
    } catch {
      if (cancelled()) throw new DOMException('Request cancelled', 'AbortError');
    }
    throw new ApiError(response.status, code);
  }
  if (response.status === 204 || response.headers.get('content-length') === '0')
    return undefined as T;
  try {
    const body = await response.text();
    if (!body) return undefined as T;
    return JSON.parse(body) as T;
  } catch (cause) {
    if (cancelled()) throw cause;
    throw new ApiError(0);
  }
}
