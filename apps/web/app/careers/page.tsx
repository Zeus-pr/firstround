import type { Metadata } from 'next';
import { LegalSheet } from '@/components/LegalSheet';

export const metadata: Metadata = { title: 'Careers · First Round' };

export default function CareersPage() {
  return (
    <LegalSheet title="Careers">
      <p>We are a small team building First Round. There are no open roles listed today.</p>
      <p>
        If you still want to say hello, write to{' '}
        <a href="mailto:support@firstround.space">support@firstround.space</a> with a short note
        about what you build.
      </p>
    </LegalSheet>
  );
}
