import Link from 'next/link';
import { HomeLetter } from '@/components/HomeLetter';

export default async function Page({ searchParams }: { searchParams: Promise<{ seat?: string }> }) {
  const params = await searchParams;

  return (
    <>
      <a className="skip" href="#email">
        Skip to the seat
      </a>
      <main>
        <HomeLetter initialSeat={params.seat} />
      </main>
      <footer className="foot">
        <div className="frame foot-grid">
          <div>
            <p className="foot-name">First Round</p>
            <p className="foot-line">No letter leaves without you.</p>
          </div>
          <nav className="foot-nav" aria-label="Footer">
            <Link href="/login">Log in</Link>
            <Link href="/signup">Sign up</Link>
          </nav>
          <p className="foot-year">2026</p>
        </div>
      </footer>
    </>
  );
}
