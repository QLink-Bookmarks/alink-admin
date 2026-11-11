import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useSession } from '../features/auth/queries';
import { session } from '../features/auth/session';

export function AdminShell() {
  const state = useSession();
  const [accountOpen, setAccountOpen] = useState(false);
  if (state.status === 'loading')
    return (
      <main className="login-shell">
        <p role="status">세션 확인 중이에요…</p>
      </main>
    );
  if (state.status === 'denied')
    return (
      <main className="login-shell">
        <section className="login-card" role="alert">
          <h1>접근 권한이 없어요</h1>
          <p>관리자 권한을 확인한 뒤 다시 로그인해 주세요</p>
          <Button onClick={() => void session.logout()}>다시 로그인</Button>
        </section>
      </main>
    );
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
              <NavLink key={to} to={to!}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="account-wide">
            <strong>{state.profile?.nickname}</strong>
            <span className="badge">{state.profile?.role}</span>
            <Button onClick={() => void session.logout()}>로그아웃</Button>
          </div>
          <div className="account-mobile">
            <Button aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}>
              계정
            </Button>
            {accountOpen && (
              <div className="account-pop card">
                <strong>{state.profile?.nickname}</strong>
                <p>{state.profile?.role}</p>
                <Button onClick={() => void session.logout()}>로그아웃</Button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="app-content" id="main-content">
        <Outlet />
      </main>
    </>
  );
}
