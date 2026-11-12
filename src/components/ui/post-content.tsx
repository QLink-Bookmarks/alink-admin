import { useState } from 'react';
import { parsePostContent } from '../../lib/post-content';

export function PostImage({ url, linked = false }: { url: string; linked?: boolean }) {
  const [failed, setFailed] = useState(false);
  const content = failed ? (
    <div className="image-placeholder" role="img" aria-label="이미지를 불러올 수 없어요" />
  ) : (
    <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
  );
  return linked ? (
    <a
      className="attachment"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="첨부 이미지 원본 열기 (새 탭)"
    >
      {content}
    </a>
  ) : (
    content
  );
}
export function PostContent({ contents }: { contents: string }) {
  return (
    <div className="post-content">
      {parsePostContent(contents).map((block, index) =>
        block.kind === 'text' ? (
          <p key={index}>{block.value}</p>
        ) : block.kind === 'image' ? (
          <PostImage key={`${index}-${block.url}`} url={block.url} />
        ) : (
          <a
            key={index}
            className={block.kind === 'button' ? 'button post-button' : 'post-link'}
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={block.kind === 'link' ? `${block.label} (새 탭)` : undefined}
          >
            {block.label}
          </a>
        ),
      )}
    </div>
  );
}
