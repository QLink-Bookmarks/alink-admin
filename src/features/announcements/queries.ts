import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getAnnouncement, getAnnouncements } from './api';

export const announcementKeys = {
  all: ['announcements'] as const,
  lists: ['announcements', 'list'] as const,
  list: (query: string) =>
    ['announcements', 'list', { query, sort: 'createdAt,desc', size: 15 }] as const,
  detail: (id: string) => ['announcements', 'detail', id] as const,
};
export const useAnnouncements = (query: string) =>
  useInfiniteQuery({
    queryKey: announcementKeys.list(query),
    queryFn: ({ signal, pageParam }) => getAnnouncements(query, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => (page.hasNext ? (page.nextCursor ?? undefined) : undefined),
    staleTime: 0,
  });
export const useAnnouncement = (id: string) =>
  useQuery({
    queryKey: announcementKeys.detail(id),
    queryFn: ({ signal }) => getAnnouncement(id, signal),
    staleTime: 0,
  });
export function useRefreshAnnouncements() {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries({ queryKey: announcementKeys.all }), [client]);
}
