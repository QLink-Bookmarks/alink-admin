import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getFeedback, getFeedbacks } from './api';

export const useFeedbacks = (query: string) =>
  useInfiniteQuery({
    queryKey: ['feedback', 'list', { query, sort: 'createdAt,desc', size: 15 }],
    queryFn: ({ signal, pageParam }) => getFeedbacks(query, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => (page.hasNext ? (page.nextCursor ?? undefined) : undefined),
    staleTime: 0,
  });
export const useFeedback = (id: string) =>
  useQuery({
    queryKey: ['feedback', 'detail', id],
    queryFn: ({ signal }) => getFeedback(id, signal),
    staleTime: 0,
  });
