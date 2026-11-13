export type PostBlock =
  | { kind: 'text'; value: string }
  | { kind: 'image'; url: string }
  | { kind: 'button' | 'link'; label: string; url: string };
export const isSafeUrl = (value: string) => /^https?:\/\//i.test(value.trim());
export function parsePostContent(contents: string): PostBlock[] {
  const blocks: PostBlock[] = [];
  let lastIndex = 0;
  const pushText = (value: string) => {
    const text = value.replace(/^\n+|\n+$/g, '');
    if (text) blocks.push({ kind: 'text', value: text });
  };
  for (const match of contents.matchAll(/\[(img|btn|link):([^\]]+)\]/g)) {
    const tag = match[1]!;
    const payload = match[2]!;
    let block: PostBlock | null = null;
    if (tag === 'img') {
      if (isSafeUrl(payload.trim())) block = { kind: 'image', url: payload.trim() };
    } else {
      const separator = payload.indexOf('|');
      const label = payload.slice(0, separator).trim();
      const url = payload.slice(separator + 1).trim();
      if (separator >= 0 && label && isSafeUrl(url))
        block = { kind: tag === 'btn' ? 'button' : 'link', label, url };
    }
    if (!block) continue;
    pushText(contents.slice(lastIndex, match.index));
    blocks.push(block);
    lastIndex = match.index + match[0].length;
  }
  pushText(contents.slice(lastIndex));
  return blocks;
}
export function buildLinkTag(kind: 'btn' | 'link', label: string, url: string) {
  if (!label.trim() || /[\]|]/.test(label) || !isSafeUrl(url) || /[\]\r\n]/.test(url)) return null;
  return `[${kind}:${label.trim()}|${url.trim()}]`;
}
