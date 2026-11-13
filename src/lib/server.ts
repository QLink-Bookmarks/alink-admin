import { env } from './env';

export type ServerId = 'dev' | 'prod';

export const serverIds = ['dev', 'prod'] as const satisfies readonly ServerId[];
export const serverLabels: Record<ServerId, string> = { dev: '개발', prod: '운영' };

const lastServerKey = 'alink-admin:last-server';

export const isServerId = (value: unknown): value is ServerId =>
  value === 'dev' || value === 'prod';

export const apiBaseUrl = (server: ServerId) => env.servers[server].apiBaseUrl;
export const googleClientId = (server: ServerId) => env.servers[server].googleClientId;

export function readLastServer(): ServerId {
  try {
    const value = localStorage.getItem(lastServerKey);
    return isServerId(value) ? value : 'dev';
  } catch {
    return 'dev';
  }
}

export function saveLastServer(server: ServerId) {
  try {
    localStorage.setItem(lastServerKey, server);
  } catch {
    return;
  }
}
