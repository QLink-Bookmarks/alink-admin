import type { ReactNode } from 'react';

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      <header className="app-header">
        <span className="brand">ALink</span>
      </header>
      <main className="app-content" id="main-content">
        {children}
      </main>
    </>
  );
}
