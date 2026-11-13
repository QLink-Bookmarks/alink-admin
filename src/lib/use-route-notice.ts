import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useRouteNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const incoming = (location.state as { notice?: string } | null)?.notice;
  const [notice, setNotice] = useState(incoming ?? '');
  if (incoming && incoming !== notice) setNotice(incoming);
  useEffect(() => {
    if (incoming)
      void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [incoming, location.pathname, location.search, navigate]);
  return notice;
}
