import { ApiError } from './api-error';

type ApiPath = `/api/${string}`;
type ApiOptions = Omit<RequestInit, 'credentials' | 'redirect'> & { accessToken?: string };

const csrfPaths = new Set(['/api/auth/admin/token/refresh', '/api/auth/admin/signout']);

export async function apiRequest<T>(path: ApiPath, options: ApiOptions = {}): Promise<T> {
  if (!path.startsWith('/api/') || path.includes('\\') || /[\r\n]/.test(path)) {
    throw new Error('올바른 API 경로가 아니에요');
  }
  const url = new URL(path, 'https://admin.invalid');
  if (url.origin !== 'https://admin.invalid' || !url.pathname.startsWith('/api/')) {
    throw new Error('올바른 API 경로가 아니에요');
  }
  const { accessToken, ...requestOptions } = options;
  const headers = new Headers(options.headers);
  headers.set('Alink-Requester', 'admin');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (csrfPaths.has(url.pathname)) headers.set('csrf_token', crypto.randomUUID());
  let response: Response;
  try {
    response = await fetch(path, {
      ...requestOptions,
      headers,
      credentials: 'include',
      redirect: 'error',
    });
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    throw new ApiError(0);
  }
  if (!response.ok) {
    let code = '';
    try {
      const body = (await response.json()) as { code?: unknown; error?: { code?: unknown } };
      const value = body.code ?? body.error?.code;
      if (typeof value === 'string') code = value;
    } catch {
      if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
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
    if (options.signal?.aborted) throw cause;
    throw new ApiError(0);
  }
}
