import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { AccessDenied } from '../features/auth/access-denied';
import { useSession } from '../features/auth/queries';
import { ServerBadge } from '../features/auth/server-badge';
import { session } from '../features/auth/session';

export function AdminShell() {
  const state = useSession();
  const [accountOpen, setAccountOpen] = useState(false);
  const { pathname } = useLocation();
  const page = pathname.startsWith('/providers') ? '/providers' : pathname;
  const main = useRef<HTMLElement>(null);
  const shownPage = useRef(page);
  const account = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shownPage.current === page) return;
    shownPage.current = page;
    const container = main.current;
    if (!container) return;
    const focusHeading = () => {
      const heading = container.querySelector<HTMLElement>('h1');
      if (!heading) return false;
      heading.tabIndex = -1;
      heading.focus();
      return true;
    };
    if (focusHeading()) return;
    const observer = new MutationObserver(() => {
      if (focusHeading()) observer.disconnect();
    });
    const stop = () => observer.disconnect();
    observer.observe(container, { childList: true, subtree: true });
    document.addEventListener('focusin', stop, { once: true });
    return () => {
      stop();
      document.removeEventListener('focusin', stop);
    };
  }, [page]);
  useEffect(() => {
    if (!accountOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setAccountOpen(false);
      account.current?.querySelector<HTMLElement>('[aria-controls="account-menu"]')?.focus();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!account.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [accountOpen]);
  if (state.status === 'loading')
    return (
      <main className="login-shell">
        <p role="status">세션 확인 중이에요…</p>
      </main>
    );
  if (state.status === 'denied') return <AccessDenied server={state.server} />;
  if (state.status !== 'authenticated') return <Navigate to="/login" replace />;
  return (
    <>
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      <header className="app-header">
        <div className="header-inner">
          <Link to="/providers" className="brand">
            ALink <small>관리자</small>
          </Link>
          <nav aria-label="관리 메뉴">
            {[
              ['/providers', '제공자 및 모델'],
              ['/announcements', '공지사항'],
              ['/feedbacks', '피드백'],
            ].map(([to, label]) => (
              <NavLink key={to} to={to!} onClick={() => setAccountOpen(false)}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="account-wide">
            <ServerBadge server={state.server} />
            <strong title={state.profile?.nickname}>{state.profile?.nickname}</strong>
            <span className="badge">{state.profile?.role}</span>
            <Button onClick={() => void session.logout()}>로그아웃</Button>
          </div>
          <div className="account-mobile" ref={account}>
            <ServerBadge server={state.server} />
            <Button
              aria-expanded={accountOpen}
              aria-controls="account-menu"
              onClick={() => setAccountOpen(!accountOpen)}
            >
              계정
            </Button>
            {accountOpen && (
              <div className="account-pop card" id="account-menu">
                <strong>{state.profile?.nickname}</strong>
                <p>{state.profile?.role}</p>
                <Button onClick={() => void session.logout()}>로그아웃</Button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="app-content" id="main-content" ref={main}>
        <Outlet />
      </main>
    </>
  );
}
