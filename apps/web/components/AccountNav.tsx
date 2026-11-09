'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

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
        <span>{user.email}</span>
        <button
          className="mast-signup"
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
