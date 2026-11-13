import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { session } from '../features/auth/session';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } }),
  );
  useEffect(() => {
    session.setCacheClearer(() => {
      void queryClient.cancelQueries();
      queryClient.clear();
    });
    void session.bootstrap();
    const handlePageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      document.documentElement.style.visibility = 'hidden';
      session.suspend();
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted)
        void session.restore().finally(() => {
          document.documentElement.style.visibility = '';
        });
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [queryClient]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
