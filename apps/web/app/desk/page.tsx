import type { Metadata } from 'next';
import { DeskOnboarding } from '@/components/desk/DeskOnboarding';
import { DeskSurface } from '@/components/desk/DeskSurface';

export const metadata: Metadata = {
  title: 'Dashboard · First Round',
  description: 'Upload your CV and see your firstround score.',
};

export default function DeskPage() {
  return (
    <DeskSurface>
      <DeskOnboarding />
    </DeskSurface>
  );
}
