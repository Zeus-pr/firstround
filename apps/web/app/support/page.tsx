import type { Metadata } from 'next';
import { LegalSheet } from '@/components/LegalSheet';

export const metadata: Metadata = { title: 'Support · First Round' };

export default function SupportPage() {
  return (
    <LegalSheet title="Support">
      <p>
        Need help with your seat, sign-in, or a stuck upload? Write to us and include the email on
        your account.
      </p>
      <p>
        Email <a href="mailto:support@firstround.space">support@firstround.space</a>. We read every
        note.
      </p>
      <p>For security issues, use the Report security issues page instead of this address.</p>
    </LegalSheet>
  );
}
