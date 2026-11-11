import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProvider, getProviders } from './api';

export const providerKeys = { all: ['providers'] as const, list: ['providers', 'list', { includesInactive: true, sort: 'type,id' }] as const, detail: (id: string) => ['providers', 'detail', id, { sort: 'priority,id' }] as const };
export const useProviders = () => useQuery({ queryKey: providerKeys.list, queryFn: ({ signal }) => getProviders(signal), staleTime: 0 });
export const useProvider = (id: string) => useQuery({ queryKey: providerKeys.detail(id), queryFn: ({ signal }) => getProvider(id, signal), staleTime: 0 });
export function useRefreshProviders() { const client = useQueryClient(); return () => client.invalidateQueries({ queryKey: providerKeys.all }); }
