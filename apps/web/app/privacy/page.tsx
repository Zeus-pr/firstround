import type { Metadata } from 'next';
import { LegalSheet } from '@/components/LegalSheet';

export const metadata: Metadata = { title: 'Privacy policy · First Round' };

export default function PrivacyPage() {
  return (
    <LegalSheet title="Privacy policy">
      <p>
        First Round helps you send reviewed outreach from your own Gmail. This page explains what we
        collect and why.
      </p>
      <h2>What we collect</h2>
      <p>
        Account email and sign-in identity from Firebase. Your CV file and the structured facts we
        extract from it. Job preferences you enter. Gmail tokens only after you connect Gmail,
        stored encrypted.
      </p>
      <h2>How we use it</h2>
      <p>
        To run your desk: readiness scoring, matching later, and sending only letters you approve.
        We do not sell your data. We do not train public models on your CV.
      </p>
      <h2>Processors</h2>
      <p>
        Hosting and database on Railway. File storage on Cloudflare R2. Auth on Firebase. Optional
        CV extraction through xAI. Future Gmail access through Google.
      </p>
      <h2>Your choices</h2>
      <p>
        You can ask us to delete your account and files. Contact Support. We will keep what the law
        requires and nothing more for longer than needed.
      </p>
      <p>Last updated 10 November 2026.</p>
    </LegalSheet>
  );
}
