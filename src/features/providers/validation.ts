import type { ProviderType } from './api';

export const officialHosts: Record<ProviderType, string> = {
  GEMINI: 'generativelanguage.googleapis.com',
  OPENAI: 'api.openai.com',
  CLAUDE: 'api.anthropic.com',
};
export function validBaseUrl(type: ProviderType, value: string) {
  try {
    const url = new URL(value);
    const rawPath = value.match(/^https:\/\/[^/]+(\/[^?#]*)?$/)?.[1] ?? '';
    return (
      value.length <= 255 &&
      value === value.trim() &&
      !/[?#]/.test(value) &&
      url.protocol === 'https:' &&
      url.hostname === officialHosts[type] &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      rawPath
        .split('/')
        .every((part) => part !== '.' && part !== '..' && /^[A-Za-z0-9._-]*$/.test(part))
    );
  } catch {
    return false;
  }
}
export const validModelName = (value: string) => /^[A-Za-z0-9._-]{1,100}$/.test(value);
export const positiveInteger = (value: string) =>
  /^\d+$/.test(value) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0 &&
  Number(value) <= 2147483647;
