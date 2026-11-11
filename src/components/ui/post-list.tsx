import { Link } from 'react-router-dom';
import { Button } from './button';
import { TextField } from './text-field';
import { Table } from './table';
import { RequestState } from './request-state';
import { formatDate } from '../../lib/format';
import { useSearch } from '../../lib/use-search';
import type { PostSummary } from '../../features/announcements/api';

export function PostList({
  feedback = false,
  search,
  items,
  pending,
  error,
  fetchingNext,
  hasNext,
  onRetry,
  onMore,
}: {
  feedback?: boolean;
  search: ReturnType<typeof useSearch>;
  items: PostSummary[];
  pending: boolean;
  error: unknown;
  fetchingNext: boolean;
  hasNext: boolean;
  onRetry: () => void;
  onMore: () => void;
}) {
  const title = feedback ? '피드백' : '공지사항';
  const path = feedback ? '/feedbacks' : '/announcements';
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{feedback ? '사용자가 보내 준 의견을 확인해요' : '사용자에게 새로운 소식을 전해요'}</p>
        </div>
        {!feedback && (
          <Link className="button primary" to="/announcements/new">
            공지 등록
          </Link>
        )}
      </div>
      <div className="search-row">
        <TextField
          label="제목 검색"
          type="search"
          placeholder="제목으로 검색"
          value={search.input}
          onChange={(event) => search.setInput(event.target.value)}
          onCompositionStart={() => search.setComposing(true)}
          onCompositionEnd={() => search.setComposing(false)}
        />
        {search.input && <Button onClick={search.clear}>검색 지우기</Button>}
      </div>
      <RequestState pending={pending} error={error} onRetry={onRetry} />
      {!pending && !error && items.length === 0 && (
        <section className="state card" role="status">
          <h2>
            {search.query
              ? `“${search.query}” 검색 결과가 없어요`
              : feedback
                ? '접수된 피드백이 없어요'
                : '아직 등록된 공지가 없어요'}
          </h2>
          {search.query ? (
            <Button onClick={search.clear}>검색 지우기</Button>
          ) : (
            !feedback && (
              <Link className="button" to="/announcements/new">
                첫 공지 등록
              </Link>
            )
          )}
        </section>
      )}
      {items.length > 0 && (
        <div className="card list-card">
          <Table caption={`${title} 목록`}>
            <thead>
              <tr>
                <th scope="col">제목</th>
                <th scope="col">작성자</th>
                <th scope="col">{feedback ? '접수일' : '등록일'}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((post) => (
                <tr key={post.id}>
                  <td>
                    <Link className="truncate" title={post.title} to={`${path}/${post.id}`}>
                      {post.title}
                    </Link>
                  </td>
                  <td>{post.author}</td>
                  <td>{formatDate(post.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      {hasNext && (
        <Button
          aria-disabled={fetchingNext}
          onClick={() => {
            if (!fetchingNext) onMore();
          }}
        >
          {fetchingNext ? '불러오는 중…' : '더 보기'}
        </Button>
      )}
    </div>
  );
}
