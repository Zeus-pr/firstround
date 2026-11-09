import type { Metadata } from 'next';
import { LegalSheet } from '@/components/LegalSheet';

export const metadata: Metadata = { title: 'Cookie preferences · First Round' };

export default function CookiesPage() {
  return (
    <LegalSheet title="Cookie preferences">
      <p>First Round uses only what we need to keep you signed in and to run the product.</p>
      <p>
        We do not run a third-party ad cookie wall. Firebase Auth may set session cookies for
        sign-in. Analytics cookies are off unless we add them later and ask you clearly.
      </p>
      <p>If that changes, this page will say so and give you a real choice.</p>
    </LegalSheet>
  );
}
