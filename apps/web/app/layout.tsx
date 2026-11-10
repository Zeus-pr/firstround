import type { Metadata } from 'next';
import '@fontsource-variable/google-sans';
import { Mast } from '@/components/Mast';
import { SiteFooter } from '@/components/SiteFooter';
import './globals.css';

export const metadata: Metadata = {
  title: 'First Round',
  description:
    'Find jobs, email recruiters from your Gmail. You approve every email before it sends.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Mast />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
