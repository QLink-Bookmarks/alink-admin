import { apiRequest } from '../../lib/api-client';
import type { ServerId } from '../../lib/server';

export type Profile = {
  nickname: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  avatarUrl?: string;
  avatarEmoji?: string;
};
export type AuthOptions = RequestInit & { accessToken?: string; timeout?: number };
export async function authRequest<T>(
  server: ServerId,
  path: `/api/${string}`,
  options: AuthOptions = {},
) {
  const response = await apiRequest<{ data: T }>(path, { ...options, server });
  return response?.data;
}
export const signIn = (server: ServerId, credential: string, timeout: number) =>
  authRequest<{ accessToken: string }>(server, '/api/auth/admin/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'GOOGLE', token: credential }),
    timeout,
  });
export const refreshToken = (server: ServerId, timeout?: number) =>
  authRequest<{ accessToken: string }>(server, '/api/auth/admin/token/refresh', {
    method: 'POST',
    timeout,
  });
export const signOut = (server: ServerId, accessToken?: string) =>
  authRequest(server, '/api/auth/admin/signout', { method: 'DELETE', accessToken });
