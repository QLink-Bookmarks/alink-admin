import { Link, useParams } from 'react-router-dom';
import { PostList } from '../../components/ui/post-list';
import { PostContent, PostImage } from '../../components/ui/post-content';
import { RequestState } from '../../components/ui/request-state';
import { formatDate } from '../../lib/format';
import { useSearch } from '../../lib/use-search';
import { usePageTitle } from '../../lib/use-page-title';
import { isSafeUrl } from '../../lib/post-content';
import { useFeedback, useFeedbacks } from './queries';

export function FeedbackPage() {
  const search = useSearch();
  const query = useFeedbacks(search.query);
  return (
    <PostList
      feedback
      search={search}
      items={query.data?.pages.flatMap((page) => page.contents) ?? []}
      pending={query.isPending}
      error={query.error}
      fetchingNext={query.isFetchingNextPage}
      hasNext={query.hasNextPage}
      onRetry={() => void query.refetch()}
      onMore={() => void query.fetchNextPage()}
    />
  );
}
export function FeedbackDetailPage() {
  const { id = '' } = useParams();
  const query = useFeedback(id);
  const post = query.data;
  usePageTitle(post?.type === 'FEEDBACK' ? post.title : undefined, '피드백');
  return (
    <div className="stack">
      <Link className="back-link" to="/feedbacks">
        ← 피드백 목록
      </Link>
      <RequestState
        pending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
      {post && post.type === 'FEEDBACK' && (
        <article className="card document">
          <h1>{post.title}</h1>
          <dl>
            <dt>작성자</dt>
            <dd>
              {post.author} · 사용자 번호 {post.authorId}
            </dd>
            <dt>접수일</dt>
            <dd>{formatDate(post.createdAt)}</dd>
            <dt>피드백 번호</dt>
            <dd>{post.id}</dd>
          </dl>
          <PostContent contents={post.contents} />
          {post.imageUrls.length > 0 && (
            <section aria-label="첨부 이미지" className="attachments">
              {post.imageUrls.filter(isSafeUrl).map((url) => (
                <PostImage key={url} url={url} linked />
              ))}
            </section>
          )}
        </article>
      )}
    </div>
  );
}
