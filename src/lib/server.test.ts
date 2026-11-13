import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEnv } from './env';
import { readLastServer, saveLastServer } from './server';

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};
afterEach(() => vi.unstubAllGlobals());

describe('server selection', () => {
  it('uses the channel API domains when a build has no overrides', () => {
    expect(createEnv({}).servers).toEqual({
      dev: { apiBaseUrl: 'https://dev.api.archivelink.app', googleClientId: '' },
      prod: { apiBaseUrl: 'https://api.archivelink.app', googleClientId: '' },
    });
  });

  it('uses public build overrides without a trailing slash', () => {
    const { servers } = createEnv({
      VITE_DEV_API_BASE_URL: ' https://dev.example.test/ ',
      VITE_PROD_API_BASE_URL: 'https://prod.example.test',
    });
    expect(servers.dev.apiBaseUrl).toBe('https://dev.example.test');
    expect(servers.prod.apiBaseUrl).toBe('https://prod.example.test');
  });

  it('uses the two same-origin proxies in the local dev server', () => {
    const { servers } = createEnv({
      DEV: true,
      VITE_DEV_API_BASE_URL: 'https://dev.example.test',
    });
    expect(servers.dev.apiBaseUrl).toBe('/server/dev');
    expect(servers.prod.apiBaseUrl).toBe('/server/prod');
  });

  it('shares one Google client unless production has its own', () => {
    const shared = createEnv({ VITE_GOOGLE_CLIENT_ID: 'admin-client' }).servers;
    expect([shared.dev.googleClientId, shared.prod.googleClientId]).toEqual([
      'admin-client',
      'admin-client',
    ]);
    const split = createEnv({
      VITE_GOOGLE_CLIENT_ID: 'admin-client',
      VITE_PROD_GOOGLE_CLIENT_ID: 'prod-client',
    }).servers;
    expect([split.dev.googleClientId, split.prod.googleClientId]).toEqual([
      'admin-client',
      'prod-client',
    ]);
  });

  it('stores only the last server id and reads it back', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    expect(readLastServer()).toBe('dev');
    saveLastServer('prod');
    expect([...storage.values]).toEqual([['alink-admin:last-server', 'prod']]);
    expect(readLastServer()).toBe('prod');
  });

  it.each(['staging', 'PROD', '', '"prod"'])('falls back to dev for stored %j', (value) => {
    const storage = memoryStorage();
    storage.values.set('alink-admin:last-server', value);
    vi.stubGlobal('localStorage', storage);
    expect(readLastServer()).toBe('dev');
  });

  it('falls back to dev and keeps working when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    expect(readLastServer()).toBe('dev');
    expect(() => saveLastServer('prod')).not.toThrow();
  });
});
