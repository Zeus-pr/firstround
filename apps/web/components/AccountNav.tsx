'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

export function AccountNav() {
  const [user, setUser] = useState<User | null>(null);
  const path = usePathname();

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (user) {
    return (
      <nav className="mast-nav" aria-label="Account">
        {path?.startsWith('/desk') ? null : <span className="mast-account-name">{user.email}</span>}
        <Link className="mast-signup" href="/desk">
          Dashboard
        </Link>
        <button
          className="mast-signout"
          type="button"
          onClick={() => {
            const auth = firebaseAuth();
            if (auth) void signOut(auth);
          }}
        >
          Sign out
        </button>
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
