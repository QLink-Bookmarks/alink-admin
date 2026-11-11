import { ApiError } from '../../lib/api-error';
import { authRequest, refreshToken, signIn, signOut, type Profile } from './api';

type Session = { status: 'loading' | 'guest' | 'authenticated' | 'denied'; profile?: Profile; reason?: string };
let snapshot: Session = { status: 'loading' };
let accessToken: string | undefined;
let expiresAt = 0;
let generation = 0;
let clearCache = () => {};
let refreshing: Promise<void> | undefined;
let booting: Promise<void> | undefined;
const listeners = new Set<() => void>();
const deniedCodes = new Set(['AUTH_403_0002', 'AI_403_0002', 'POST_403_0001', 'POST_403_0002', 'AI_404_0004', 'POST_404_0003', 'USER_404_0001']);
function publish(value: Session) { snapshot = value; listeners.forEach((listener) => listener()); }
function storeToken(token: string) {
  accessToken = token;
  expiresAt = Date.now() + 15 * 60_000;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    if (payload.exp) expiresAt = payload.exp * 1000;
  } catch { expiresAt = Date.now() + 15 * 60_000; }
}
function endSession(denied: boolean, expired = true) {
  const token = accessToken;
  generation++;
  accessToken = undefined;
  clearCache();
  publish({ status: denied ? 'denied' : 'guest', reason: expired ? '세션이 만료됐어요' : undefined });
  if (denied) void signOut(token).catch(() => {});
}
async function refresh() {
  if (!refreshing) {
    const current = generation;
    refreshing = refreshToken().then((result) => {
      if (generation !== current) throw new ApiError(401);
      storeToken(result.accessToken);
    }).catch((error: unknown) => {
      if (generation === current) endSession(error instanceof ApiError && deniedCodes.has(error.code), snapshot.status !== 'loading');
      throw error;
    }).finally(() => { refreshing = undefined; });
  }
  return refreshing;
}
export const session = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot: () => snapshot,
  setCacheClearer(callback: () => void) { clearCache = callback; },
  bootstrap() {
    if (!booting) booting = (async () => {
      try { await refresh(); await session.loadProfile(); }
      catch { if (snapshot.status === 'loading') publish({ status: 'guest' }); }
    })();
    return booting;
  },
  async loadProfile() {
    const profile = await session.request<Profile>('/api/users/me');
    if (!['ADMIN', 'SUPER_ADMIN'].includes(profile.role)) { endSession(true); return; }
    publish({ status: 'authenticated', profile });
  },
  async login(credential: string) {
    const current = generation;
    const result = await signIn(credential);
    if (current !== generation) return;
    storeToken(result.accessToken);
    await session.loadProfile();
  },
  async logout() {
    const token = accessToken;
    endSession(false, false);
    try { await signOut(token); } catch { publish({ status: 'guest', reason: '로그아웃 요청을 완료하지 못했어요. 다시 시도해 주세요' }); }
  },
  async request<T>(path: `/api/${string}`, options: RequestInit = {}): Promise<T> {
    const current = generation;
    if (!accessToken || Date.now() >= expiresAt) await refresh();
    try {
      let result: T;
      try { result = await authRequest<T>(path, options, accessToken); }
      catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        await refresh();
        result = await authRequest<T>(path, options, accessToken);
      }
      if (generation !== current) throw new ApiError(401);
      return result;
    } catch (error) {
      if (error instanceof ApiError && current === generation) {
        if (deniedCodes.has(error.code)) endSession(true);
        else if (error.status === 401) endSession(false);
      }
      throw error;
    }
  },
};
