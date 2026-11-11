'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { ProfileMenu } from '@/components/ProfileMenu';

export function AccountNav() {
  const [user, setUser] = useState<User | null>(null);
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (user) {
    return (
      <nav className="mast-nav" aria-label="Account">
        <Link className="mast-signup" href="/desk">
          Dashboard
        </Link>
        <button
          type="button"
          className="mast-profile"
          onClick={() => {
            if (path?.startsWith('/desk')) {
              window.dispatchEvent(new Event('firstround:preferences'));
              return;
            }
            sessionStorage.setItem('fr-open-preferences', '1');
            router.push('/desk');
          }}
        >
          Preferences
        </button>
        <ProfileMenu user={user} />
      </nav>
    );
  }

  return (
    <nav className="mast-nav" aria-label="Account">
      <Link href="/login">Log in</Link>
      <Link className="mast-signup" href="/signup">
        Sign up
      </Link>
    </nav>
  );
}
