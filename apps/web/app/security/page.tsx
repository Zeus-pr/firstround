import type { Metadata } from 'next';
import { LegalSheet } from '@/components/LegalSheet';

export const metadata: Metadata = { title: 'Report security issues · First Round' };

export default function SecurityPage() {
  return (
    <LegalSheet title="Report security issues">
      <p>If you find a vulnerability, tell us privately before you share it widely.</p>
      <p>
        Email <a href="mailto:security@firstround.space">security@firstround.space</a> with steps to
        reproduce. Do not include other people’s CVs or tokens.
      </p>
      <p>
        We will acknowledge receipt and work the fix. Please give us a reasonable window before
        public disclosure.
      </p>
    </LegalSheet>
  );
}
