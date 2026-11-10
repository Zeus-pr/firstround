import type { Metadata } from 'next';
import { LegalSheet } from '@/components/LegalSheet';

export const metadata: Metadata = { title: 'Terms of use · First Round' };

export default function TermsPage() {
  return (
    <LegalSheet title="Terms of use">
      <p>
        By using First Round you agree to these pilot terms. The product is early. Features can
        change.
      </p>
      <h2>Your account</h2>
      <p>
        You must use accurate sign-in details and only upload a CV you have the right to use. You
        approve every email before it sends from your Gmail.
      </p>
      <h2>Acceptable use</h2>
      <p>
        No spam, no scraped lead lists, no harassment, no attempts to break the service. We may
        suspend accounts that harm others or the system.
      </p>
      <h2>No guarantees</h2>
      <p>
        We do not promise interviews or replies. Readiness scores are First Round’s own measure, not
        a universal ATS result.
      </p>
      <p>Last updated 10 November 2026.</p>
    </LegalSheet>
  );
}
