import { describe, expect, it } from 'vitest';
import { buildLinkTag, parsePostContent } from './post-content';

describe('channel compatible post contents', () => {
  it('preserves plain newlines and renders only supported safe tags', () => {
    expect(parsePostContent('첫 줄\n둘째 줄\n[img:https://example.com/a.png]\n[btn:열기|https://example.com]\n[link:사이트|http://example.com]')).toEqual([{ kind: 'text', value: '첫 줄\n둘째 줄' }, { kind: 'image', url: 'https://example.com/a.png' }, { kind: 'button', label: '열기', url: 'https://example.com' }, { kind: 'link', label: '사이트', url: 'http://example.com' }]);
    expect(parsePostContent('[img:javascript:alert(1)]\n[link:|https://example.com]\n<script>secret</script>')).toEqual([{ kind: 'text', value: '[img:javascript:alert(1)]\n[link:|https://example.com]\n<script>secret</script>' }]);
  });
  it('rejects empty labels and tag delimiter injection', () => {
    for (const [label, url] of [['', 'https://example.com'], ['x|y', 'https://example.com'], ['x]', 'https://example.com'], ['x', 'javascript:evil'], ['x', 'https://example.com/]']]) expect(buildLinkTag('btn', label!, url!)).toBeNull();
    expect(buildLinkTag('link', ' 사이트 ', 'https://example.com')).toBe('[link:사이트|https://example.com]');
  });
});
