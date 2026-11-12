import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { env } from '../../lib/env';
import { ApiError } from '../../lib/api-error';
import { Button } from '../../components/ui/button';
import { usePageTitle } from '../../lib/use-page-title';
import { useSession } from './queries';
import { session } from './session';

type Gis = {
  initialize: (options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }) => void;
  renderButton: (element: HTMLElement, options: object) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: Gis } };
  }
}
export function LoginPage() {
  const state = useSession();
  const target = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  usePageTitle('로그인');
  useEffect(() => {
    if (!env.googleClientId || pending) return;
    let active = true;
    const element = target.current;
    const render = () => {
      if (!active || !target.current || !window.google?.accounts.id.renderButton) return;
      window.google.accounts.id.initialize({
        client_id: env.googleClientId,
        callback: (response) => {
          if (busy.current) return;
          busy.current = true;
          setPending(true);
          setError('');
          void session
            .login(response.credential)
            .catch((cause: unknown) => {
              setError(
                cause instanceof ApiError && cause.status === 403
                  ? '관리자 계정이 아니에요'
                  : '로그인하지 못했어요. 다시 시도해 주세요',
              );
            })
            .finally(() => {
              busy.current = false;
              setPending(false);
            });
        },
      });
      window.google.accounts.id.renderButton(target.current, {
        type: 'standard',
        text: 'signin_with',
        locale: 'ko',
        theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'filled_black' : 'outline',
        size: 'large',
      });
    };
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = render;
    script.onerror = () => {
      if (active) setError('Google 로그인을 불러오지 못했어요. 다시 시도해 주세요');
    };
    if (window.google?.accounts.id.renderButton) render();
    else document.head.append(script);
    return () => {
      active = false;
      script.remove();
      element?.replaceChildren();
    };
  }, [pending, attempt]);
  if (state.status === 'authenticated') return <Navigate to="/providers" replace />;
  return (
    <main className="login-shell" id="main-content">
      <section className="login-card" aria-labelledby="login-heading">
        <p className="brand">
          ALink <small>관리자</small>
        </p>
        <h1 id="login-heading">관리자 로그인</h1>
        {state.reason && <p role="status">{state.reason}</p>}
        {state.reason?.startsWith('로그아웃 요청') && (
          <Button onClick={() => void session.logout()}>로그아웃 다시 시도</Button>
        )}
        {pending ? (
          <p role="status">로그인 중이에요…</p>
        ) : (
          <div className="gis-button" ref={target} />
        )}
        {!env.googleClientId && <p role="status">Google 로그인 설정이 필요해요</p>}
        {error && (
          <>
            <p role="alert">{error}</p>
            <Button
              onClick={() => {
                setError('');
                setAttempt((value) => value + 1);
              }}
            >
              다시 시도
            </Button>
          </>
        )}
      </section>
    </main>
  );
}
