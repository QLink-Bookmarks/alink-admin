import { Button } from '../components/ui/button';

export function LoginShell() {
  return (
    <main className="login-shell" id="main-content">
      <section className="login-card" aria-labelledby="login-heading">
        <p className="brand">ALink</p>
        <h1 id="login-heading">관리자 로그인</h1>
        <Button disabled>Google로 로그인</Button>
      </section>
    </main>
  );
}
