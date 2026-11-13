import { Button } from '../../components/ui/button';
import type { ServerId } from '../../lib/server';
import { usePageTitle } from '../../lib/use-page-title';
import { authCopy } from './copy';
import { session } from './session';

export function AccessDenied({ server }: { server: ServerId }) {
  usePageTitle(authCopy.deniedTitle);
  return (
    <main className="login-shell">
      <section className="login-card denied-card" aria-labelledby="denied-heading">
        <h1 id="denied-heading">{authCopy.deniedTitle}</h1>
        <p role="alert">{authCopy.deniedBody(server)}</p>
        <Button onClick={() => session.leaveDenied()}>{authCopy.signInAgain}</Button>
      </section>
    </main>
  );
}
