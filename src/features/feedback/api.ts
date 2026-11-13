import { session } from '../auth/session';
import type { Post, PostPage } from '../announcements/api';

export function getFeedbacks(query: string, cursor: string | undefined, signal: AbortSignal) {
  const params = new URLSearchParams({ type: 'FEEDBACK', query, size: '15' });
  if (cursor) params.set('cursor', cursor);
  return session.request<PostPage>(`/api/posts?${params}`, { signal });
}
export const getFeedback = (id: string, signal: AbortSignal) =>
  session.request<Post>(`/api/posts/${encodeURIComponent(id)}`, { signal });
