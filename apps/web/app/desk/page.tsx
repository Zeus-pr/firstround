import type { Metadata } from 'next';
import { DeskOnboarding } from '@/components/desk/DeskOnboarding';

export const metadata: Metadata = {
  title: 'Dashboard · First Round',
  description: 'Upload your CV and see your First Round CV score.',
};

export default function DeskPage() {
  return <DeskOnboarding />;
}
