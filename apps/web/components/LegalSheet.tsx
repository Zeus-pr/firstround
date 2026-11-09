import type { ReactNode } from 'react';

export function LegalSheet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="legal-shell">
      <article className="legal-sheet">
        <h1>{title}</h1>
        <div className="legal-body">{children}</div>
      </article>
    </main>
  );
}
