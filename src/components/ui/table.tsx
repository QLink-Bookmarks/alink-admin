import type { ReactNode } from 'react';

export function Table({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="table-container">
      <table>
        <caption>{caption}</caption>
        {children}
      </table>
    </div>
  );
}
