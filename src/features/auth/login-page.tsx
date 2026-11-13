import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { googleClientId, serverIds, serverLabels } from '../../lib/server';
import { Button } from '../../components/ui/button';
import { usePageTitle } from '../../lib/use-page-title';
import { authCopy } from './copy';
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
const lockedKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']);
export function LoginPage() {
  const state = useSession();
  const target = useRef<HTMLDivElement>(null);
  const [scriptFailed, setScriptFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const clientId = googleClientId(state.server);
  const pending = state.pending === true;
  const locked = pending || state.status === 'loading';
  const notice = state.status === 'guest' ? state.notice : undefined;
  const noticeSlot = useRef<HTMLDivElement>(null);
  usePageTitle('로그인');
  useEffect(() => {
    if (!notice || notice === 'expired') return;
    const slot = noticeSlot.current;
    (
      slot?.querySelector<HTMLElement>('button') ?? slot?.querySelector<HTMLElement>('[tabindex]')
    )?.focus();
  }, [notice]);
  useEffect(() => {
    if (!clientId) return;
    let active = true;
    const element = target.current;
    const render = () => {
      if (!active || !target.current || !window.google?.accounts.id.renderButton) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => void session.login(response.credential),
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
      if (active) setScriptFailed(true);
    };
    if (window.google?.accounts.id.renderButton) render();
    else document.head.append(script);
    return () => {
      active = false;
      script.remove();
      element?.replaceChildren();
    };
  }, [clientId, attempt]);
  const handleBlocked = (event: SyntheticEvent) => {
    if (locked) event.preventDefault();
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (locked && lockedKeys.has(event.key)) event.preventDefault();
  };
  if (state.status === 'authenticated') return <Navigate to="/providers" replace />;
  return (
    <main className="login-shell" id="main-content">
      <section className="login-card" aria-labelledby="login-heading">
        <p className="brand">
          ALink <small>관리자</small>
        </p>
        <h1 id="login-heading">관리자 로그인</h1>
        <fieldset
          className="server-select"
          aria-disabled={locked || undefined}
          onMouseDown={handleBlocked}
          onClick={handleBlocked}
          onKeyDown={handleKeyDown}
        >
          <legend>{authCopy.serverGroup}</legend>
          <div className="server-options">
            {serverIds.map((id) => (
              <label key={id} data-server={id}>
                <input
                  type="radio"
                  name="server"
                  value={id}
                  checked={state.server === id}
                  aria-disabled={locked || undefined}
                  onChange={() => session.select(id)}
                />
                {serverLabels[id]}
              </label>
            ))}
          </div>
        </fieldset>
        {pending && (
          <p className="login-pending" role="status">
            {authCopy.signingIn(state.server)}
          </p>
        )}
        <div
          className="gis-button"
          data-pending={pending || undefined}
          inert={pending}
          ref={target}
        />
        <div className="login-notice" ref={noticeSlot}>
          {notice === 'expired' && <p role="status">{authCopy.notices.expired(state.server)}</p>}
          {notice && notice !== 'expired' && (
            <p role="alert" tabIndex={-1}>
              {authCopy.notices[notice](state.server)}
            </p>
          )}
          {notice === 'offline' && (
            <Button onClick={() => void session.retry()}>{authCopy.retry}</Button>
          )}
          {notice === 'logout-failed' && (
            <Button onClick={() => void session.logout()}>{authCopy.logoutRetry}</Button>
          )}
          {!clientId && <p role="status">{authCopy.gisMissing}</p>}
          {scriptFailed && (
            <>
              <p role="alert">{authCopy.gisFailed}</p>
              <Button
                onClick={() => {
                  setScriptFailed(false);
                  setAttempt((value) => value + 1);
                }}
              >
                {authCopy.retry}
              </Button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
