import { apiRequest } from '../../lib/api-client';

export type Profile = { nickname: string; role: 'ADMIN' | 'SUPER_ADMIN'; avatarUrl?: string; avatarEmoji?: string };
export async function authRequest<T>(path: `/api/${string}`, options: RequestInit = {}, accessToken?: string) {
  const response = await apiRequest<{ data: T }>(path, { ...options, accessToken });
  return response?.data;
}
export const signIn = (credential: string) => authRequest<{ accessToken: string }>('/api/auth/admin/sign', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'GOOGLE', token: credential }),
});
export const refreshToken = () => authRequest<{ accessToken: string }>('/api/auth/admin/token/refresh', { method: 'POST' });
export const signOut = (accessToken?: string) => authRequest('/api/auth/admin/signout', { method: 'DELETE' }, accessToken);
