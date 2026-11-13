import { useEffect } from 'react';

export function usePageTitle(...parts: (string | undefined)[]) {
  const title = [...parts.filter(Boolean), 'ALink 관리자'].join(' · ');
  useEffect(() => {
    document.title = title;
  }, [title]);
}
