import { describe, expect, it } from 'vitest';
import { positiveInteger, validBaseUrl, validModelName } from './validation';

describe('provider input contracts', () => {
  it.each(['https://api.openai.com/v1/', 'https://api.openai.com:443/v1'])(
    'accepts official URL %s',
    (value) => expect(validBaseUrl('OPENAI', value)).toBe(true),
  );
  it.each([
    'http://api.openai.com',
    'https://api.openai.com.evil.test',
    'https://user@api.openai.com',
    'https://api.openai.com/?key=x',
    'https://api.openai.com/#x',
    'https://api.openai.com/v1/../x',
    'https://api.openai.com/%2e',
    'https://api.openai.com:8443',
  ])('rejects unsafe URL %s', (value) => expect(validBaseUrl('OPENAI', value)).toBe(false));
  it('enforces model names and whole positive bounded limits', () => {
    expect(validModelName('a'.repeat(100))).toBe(true);
    for (const value of ['', 'a'.repeat(101), '한글', ' model', '../x'])
      expect(validModelName(value)).toBe(false);
    for (const value of ['0', '-1', '1.1', 'abc', '2147483648'])
      expect(positiveInteger(value)).toBe(false);
    expect(positiveInteger('1')).toBe(true);
  });
});
