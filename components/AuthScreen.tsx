'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

type Mode = 'signin' | 'signup';

function authNote(code: string) {
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'That email and password do not match.';
  }
  if (code === 'auth/email-already-in-use')
    return 'That address already has an account. Sign in instead.';
  if (code === 'auth/weak-password') return 'Use at least 6 characters.';
  if (code === 'auth/invalid-email') return 'That address is not a valid email.';
  if (code === 'auth/too-many-requests') return 'Too many tries. Wait a moment, then try again.';
  if (code === 'auth/unauthorized-domain') return 'This site is not allowed to sign in yet.';
  if (code === 'auth/network-request-failed')
    return 'Could not reach sign-in. Check the connection.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '';
  return 'Sign-in did not finish. Try again.';
}

export function AuthScreen({ mode }: { mode: Mode }) {
  const signingUp = mode === 'signup';
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);
  const [note, setNote] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) {
      setReady(true);
      setNote('Sign-in is not configured in this build.');
      return;
    }
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setReady(true);
    });
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const auth = firebaseAuth();
    if (!auth) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');
    setPending(true);
    setNote('');
    try {
      if (signingUp) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
      setNote(authNote(code));
    } finally {
      setPending(false);
    }
  }

  async function withGoogle() {
    const auth = firebaseAuth();
    if (!auth) return;
    setPending(true);
    setNote('');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
      setNote(authNote(code));
    } finally {
      setPending(false);
    }
  }

  async function resetPassword() {
    const auth = firebaseAuth();
    if (!auth || !formRef.current) return;
    const email = String(new FormData(formRef.current).get('email') ?? '');
    if (!email) {
      setNote('Enter the address first.');
      return;
    }
    setPending(true);
    setNote('');
    try {
      await sendPasswordResetEmail(auth, email);
      setNote('A reset letter is on its way to that address.');
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
      setNote(
        code === 'auth/user-not-found'
          ? 'If that address has an account, a reset letter is on its way.'
          : authNote(code),
      );
    } finally {
      setPending(false);
    }
  }

  if (!ready) {
    return (
      <main className="auth">
        <h1>{signingUp ? 'Create an account' : 'Sign in'}</h1>
        <p className="note">Opening sign-in.</p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="auth">
        <h1>Signed in</h1>
        <p>You are signed in as {user.email ?? 'this account'}.</p>
        <button
          className="wax"
          type="button"
          onClick={() => {
            const auth = firebaseAuth();
            if (auth) void signOut(auth);
          }}
        >
          Sign out
        </button>
      </main>
    );
  }

  const emailId = signingUp ? 'signup-email' : 'signin-email';
  const passwordId = signingUp ? 'signup-password' : 'signin-password';

  return (
    <main className="auth">
      <h1>{signingUp ? 'Create an account' : 'Sign in'}</h1>
      <p>
        {signingUp
          ? 'This is the address the letters should leave from. '
          : 'Use the address on the account. '}
        {signingUp ? (
          <Link href="/login">Sign in</Link>
        ) : (
          <Link href="/signup">Create an account</Link>
        )}
      </p>
      <form className="auth-form" ref={formRef} onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="username"
            spellCheck={false}
            enterKeyHint="next"
            required
            placeholder="you@company.com"
          />
        </div>
        <div className="field">
          <label htmlFor={passwordId}>Password</label>
          <div className="password-line">
            <input
              id={passwordId}
              name="password"
              type={visible ? 'text' : 'password'}
              autoComplete={signingUp ? 'new-password' : 'current-password'}
              enterKeyHint="done"
              minLength={signingUp ? 6 : undefined}
              required
            />
            <button
              className="text-button"
              type="button"
              aria-pressed={visible}
              onClick={() => setVisible((value) => !value)}
            >
              {visible ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        <button className="wax" type="submit" disabled={pending}>
          {pending ? 'Working' : signingUp ? 'Create account' : 'Sign in'}
        </button>
        {!signingUp ? (
          <button
            className="text-button"
            type="button"
            disabled={pending}
            onClick={() => void resetPassword()}
          >
            Forgot password
          </button>
        ) : null}
        <p className="note" role="status">
          {note}
        </p>
      </form>
      <button className="google" type="button" disabled={pending} onClick={withGoogle}>
        {signingUp ? 'Sign up with Google' : 'Sign in with Google'}
      </button>
    </main>
  );
}
