import type { Metadata } from 'next';
import { LegalSheet } from '@/components/LegalSheet';

export const metadata: Metadata = { title: 'System status · First Round' };

export default function StatusPage() {
  return (
    <LegalSheet title="System status">
      <p>
        First Round is running. If sign-in, uploads, or the API misbehave, check this page for notes
        during an incident.
      </p>
      <p>No open incidents right now.</p>
    </LegalSheet>
  );
}
