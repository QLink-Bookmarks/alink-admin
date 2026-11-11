import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { session } from '../features/auth/session';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } }),
  );
  useEffect(() => {
    session.setCacheClearer(() => { void queryClient.cancelQueries(); queryClient.clear(); });
    void session.bootstrap();
  }, [queryClient]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
