import { Button } from '../../components/ui/button';
import type { ServerId } from '../../lib/server';
import { authCopy } from './copy';
import { session } from './session';

export function AccessDenied({ server }: { server: ServerId }) {
  return (
    <main className="login-shell">
      <section className="login-card denied-card" aria-labelledby="denied-heading">
        <h1 id="denied-heading">{authCopy.deniedTitle}</h1>
        <p role="alert">{authCopy.deniedBody(server)}</p>
        <Button onClick={() => void session.logout()}>{authCopy.signInAgain}</Button>
      </section>
    </main>
  );
}
