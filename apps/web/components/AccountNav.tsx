'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { ProfileMenu } from '@/components/ProfileMenu';

export function AccountNav() {
  const [user, setUser] = useState<User | null>(null);

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
