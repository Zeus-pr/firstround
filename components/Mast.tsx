import Image from 'next/image';
import Link from 'next/link';
import { AccountNav } from '@/components/AccountNav';

export function Mast() {
  return (
    <header className="mast">
      <div className="frame mast-row">
        <Link className="word" href="/">
          <Image
            src="/brand/firstround-logo.svg"
            alt="First Round"
            className="logo"
            width={160}
            height={26}
            priority
            unoptimized
          />
        </Link>
        <AccountNav />
      </div>
    </header>
  );
}
