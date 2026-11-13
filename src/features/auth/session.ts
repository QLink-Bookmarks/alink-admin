import { ApiError } from '../../lib/api-error';
import { readLastServer, saveLastServer, type ServerId } from '../../lib/server';
import { authRequest, refreshToken, signIn, signOut, type AuthOptions, type Profile } from './api';

export type Notice = 'expired' | 'forbidden' | 'failed' | 'offline' | 'logout-failed';
type Session = {
  status: 'loading' | 'guest' | 'authenticated' | 'denied';
  server: ServerId;
  profile?: Profile;
  notice?: Notice;
  pending?: boolean;
};
type SessionState = Omit<Session, 'server'>;
export const responseLimit = 15_000;
let server = readLastServer();
let snapshot: Session = { status: 'loading', server };
let accessToken: string | undefined;
let expiresAt = 0;
let generation = 0;
let clearCache = () => {};
let refreshing: Promise<void> | undefined;
let booting: Promise<void> | undefined;
let attempting: Promise<void> | undefined;
let retryTask: (() => Promise<void>) | undefined;
const listeners = new Set<() => void>();
const adminRoles = new Set(['ADMIN', 'SUPER_ADMIN']);
const deniedCodes = new Set([
  'AUTH_403_0002',
  'AI_403_0002',
  'POST_403_0001',
  'POST_403_0002',
  'AI_404_0004',
  'POST_404_0003',
  'POST_404_0001',
  'USER_404_0001',
]);
const isOffline = (error: unknown) => error instanceof ApiError && error.status === 0;
function publish(value: SessionState) {
  snapshot = { ...value, server };
  listeners.forEach((listener) => listener());
}
function storeToken(token: string) {
  accessToken = token;
  expiresAt = Date.now() + 15 * 60_000;
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    if (payload.exp) expiresAt = payload.exp * 1000;
  } catch {
    expiresAt = Date.now() + 15 * 60_000;
  }
}
function endSession(denied: boolean, notice?: Notice, retry?: () => Promise<void>) {
  const token = accessToken;
  generation++;
  accessToken = undefined;
  retryTask = retry;
  clearCache();
  publish(denied ? { status: 'denied' } : { status: 'guest', notice });
  if (denied) void signOut(server, token).catch(() => {});
}
function refresh(timeout?: number) {
  if (!refreshing) {
    const current = generation;
    const restoring = snapshot.status === 'loading' || snapshot.pending === true;
    refreshing = refreshToken(server, timeout)
      .then((result) => {
        if (generation !== current) throw new ApiError(401);
        storeToken(result.accessToken);
      })
      .catch((error: unknown) => {
        if (generation === current) {
          const denied = error instanceof ApiError && deniedCodes.has(error.code);
          if (!restoring) endSession(denied, 'expired');
          else if (isOffline(error)) endSession(denied, 'offline', retryRestore);
          else endSession(denied);
        }
        throw error;
      })
      .finally(() => {
        refreshing = undefined;
      });
  }
  return refreshing;
}
async function loadProfile(timeout?: number) {
  const profile = await session.request<Profile>('/api/users/me', { timeout });
  if (!adminRoles.has(profile.role)) {
    endSession(true);
    return;
  }
  publish({ status: 'authenticated', profile });
}
async function restoreSession() {
  const current = generation;
  try {
    await refresh(responseLimit);
    await loadProfile(responseLimit);
  } catch (error) {
    if (generation !== current || (snapshot.status !== 'loading' && !snapshot.pending)) return;
    if (isOffline(error)) endSession(false, 'offline', retryRestore);
    else endSession(false);
  }
}
function retryRestore() {
  publish({ status: 'guest', pending: true });
  return restoreSession();
}
async function signInWith(credential: string) {
  await session.bootstrap();
  if (snapshot.status === 'authenticated' || snapshot.pending) return;
  const target = server;
  const current = ++generation;
  retryTask = undefined;
  publish({ status: 'guest', pending: true });
  try {
    const result = await signIn(target, credential, responseLimit);
    if (current !== generation) return;
    storeToken(result.accessToken);
    const profile = await authRequest<Profile>(target, '/api/users/me', {
      accessToken,
      timeout: responseLimit,
    });
    if (current !== generation) return;
    if (!adminRoles.has(profile.role)) throw new ApiError(403);
    clearCache();
    saveLastServer(target);
    publish({ status: 'authenticated', profile });
  } catch (error) {
    if (current !== generation) return;
    const token = accessToken;
    accessToken = undefined;
    if (token && !isOffline(error)) void signOut(target, token).catch(() => {});
    if (isOffline(error)) {
      retryTask = () => signInWith(credential);
      publish({ status: 'guest', notice: 'offline' });
    } else
      publish({
        status: 'guest',
        notice: error instanceof ApiError && error.status === 403 ? 'forbidden' : 'failed',
      });
  }
}
function attempt(task: () => Promise<void>) {
  if (!attempting)
    attempting = task().finally(() => {
      attempting = undefined;
    });
  return attempting;
}
export const session = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => snapshot,
  setCacheClearer(callback: () => void) {
    clearCache = callback;
  },
  suspend() {
    generation++;
    accessToken = undefined;
    retryTask = undefined;
    clearCache();
    publish({ status: 'loading' });
  },
  restore: restoreSession,
  bootstrap() {
    if (!booting) booting = restoreSession();
    return booting;
  },
  select(next: ServerId) {
    if (
      next === server ||
      snapshot.status === 'authenticated' ||
      snapshot.status === 'loading' ||
      snapshot.pending
    )
      return;
    server = next;
    retryTask = undefined;
    publish({ status: 'guest' });
  },
  login(credential: string) {
    return attempt(() => signInWith(credential));
  },
  retry() {
    const task = retryTask;
    if (!task || snapshot.pending) return Promise.resolve();
    return attempt(task);
  },
  async logout() {
    const token = accessToken;
    const target = server;
    const pendingRefresh = refreshing;
    endSession(false);
    const current = generation;
    try {
      await pendingRefresh?.catch(() => {});
      try {
        await signOut(target, token);
      } catch (cause) {
        if (!(cause instanceof ApiError) || cause.status !== 401) throw cause;
        const renewed = await refreshToken(target);
        await signOut(target, renewed.accessToken);
      }
    } catch {
      if (generation === current && server === target && !snapshot.pending)
        publish({ status: 'guest', notice: 'logout-failed' });
    }
  },
  async request<T>(path: `/api/${string}`, options: Omit<AuthOptions, 'accessToken'> = {}) {
    const current = generation;
    const target = server;
    const renew = async () => {
      await refresh();
      if (generation !== current) throw new ApiError(401);
    };
    if (!accessToken || Date.now() >= expiresAt) await renew();
    try {
      let result: T;
      try {
        result = await authRequest<T>(target, path, { ...options, accessToken });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        await renew();
        result = await authRequest<T>(target, path, { ...options, accessToken });
      }
      if (generation !== current) throw new ApiError(401);
      return result;
    } catch (error) {
      if (error instanceof ApiError && current === generation) {
        if (deniedCodes.has(error.code)) endSession(true);
        else if (error.status === 401) endSession(false, 'expired');
      }
      throw error;
    }
  },
};
