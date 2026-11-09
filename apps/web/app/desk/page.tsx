import type { Metadata } from 'next';
import { DeskOnboarding } from '@/components/desk/DeskOnboarding';

export const metadata: Metadata = {
  title: 'Desk · First Round',
  description: 'Upload your CV and see First Round LetterProof readiness.',
};

export default function DeskPage() {
  return <DeskOnboarding />;
}
