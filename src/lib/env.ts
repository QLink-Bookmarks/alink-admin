type EnvValues = {
  DEV?: boolean;
  VITE_GOOGLE_CLIENT_ID?: string;
  VITE_PROD_GOOGLE_CLIENT_ID?: string;
  VITE_DEV_API_BASE_URL?: string;
  VITE_PROD_API_BASE_URL?: string;
};

export function createEnv(values: EnvValues) {
  const read = (key: Exclude<keyof EnvValues, 'DEV'>) => values[key]?.trim() ?? '';
  const baseUrl = (key: 'VITE_DEV_API_BASE_URL' | 'VITE_PROD_API_BASE_URL', fallback: string) =>
    (read(key) || fallback).replace(/\/+$/, '');
  const googleClientId = read('VITE_GOOGLE_CLIENT_ID');
  return {
    servers: {
      dev: {
        apiBaseUrl: values.DEV
          ? '/server/dev'
          : baseUrl('VITE_DEV_API_BASE_URL', 'https://dev.api.archivelink.app'),
        googleClientId,
      },
      prod: {
        apiBaseUrl: values.DEV
          ? '/server/prod'
          : baseUrl('VITE_PROD_API_BASE_URL', 'https://api.archivelink.app'),
        googleClientId: read('VITE_PROD_GOOGLE_CLIENT_ID') || googleClientId,
      },
    },
  };
}

export const env = createEnv(import.meta.env);
