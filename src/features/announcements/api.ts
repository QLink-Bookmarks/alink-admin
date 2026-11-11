import { session } from '../auth/session';
import { jsonBody } from '../../lib/format';

export type PostSummary = { id: number; title: string; author: string; createdAt: string };
export type Post = PostSummary & {
  contents: string;
  authorId: number;
  type: 'ANNOUNCEMENT' | 'FEEDBACK';
  imageUrls: string[];
  updatedAt: string;
};
export type PostPage = { contents: PostSummary[]; nextCursor: string | null; hasNext: boolean };
export function getAnnouncements(query: string, cursor: string | undefined, signal: AbortSignal) {
  const params = new URLSearchParams({ type: 'ANNOUNCEMENT', query, size: '15' });
  if (cursor) params.set('cursor', cursor);
  return session.request<PostPage>(`/api/posts?${params}`, { signal });
}
export const getAnnouncement = (id: string, signal: AbortSignal) =>
  session.request<Post>(`/api/posts/${encodeURIComponent(id)}`, { signal });
export const createAnnouncement = (title: string, contents: string) =>
  session.request<{ id: number }>('/api/posts', {
    method: 'POST',
    ...jsonBody({ title, contents, type: 'ANNOUNCEMENT', imageUrls: [] }),
  });
export const updateAnnouncement = (id: number, title: string, contents: string) =>
  session.request(`/api/posts/${id}`, { method: 'PUT', ...jsonBody({ title, contents }) });
export const deleteAnnouncement = (id: number) =>
  session.request(`/api/posts/${id}`, { method: 'DELETE' });
export const uploadImage = (image: File) => {
  const body = new FormData();
  body.set('image', image);
  return session.request<{ url: string }>('/api/images?purpose=POST', { method: 'POST', body });
};
