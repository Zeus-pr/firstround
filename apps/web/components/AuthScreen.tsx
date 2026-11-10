'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { Orb } from '@yogesharc/thinking-orbs';
import { firebaseAuth } from '@/lib/firebase';
import { ensureAppSession } from '@/lib/session';

type Mode = 'signin' | 'signup';

const STAGE_BEATS = [
  { state: 'searching' as const, line: 'Finding open jobs' },
  { state: 'reasoning' as const, line: 'Finding the recruiter or hiring manager' },
  { state: 'working' as const, line: 'Drafting your emails' },
];

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

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

function AuthStage() {
  return (
    <aside className="auth-stage" aria-label="What First Round does">
      <p className="auth-stage-line">Your personal assistant for modern day job hunting</p>
      <ul className="auth-orbs">
        {STAGE_BEATS.map((beat) => (
          <li key={beat.state}>
            <span className="auth-orb">
              <Orb state={beat.state} size={44} label={beat.line} />
            </span>
            <span>{beat.line}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
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
      if (!next) return;
      void ensureAppSession(next)
        .then(() => {
          router.replace('/desk');
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : '';
          const unreachable =
            message.includes('Failed to fetch') ||
            message.includes('NetworkError') ||
            message.includes('NEXT_PUBLIC_API_URL');
          setNote(
            unreachable
              ? 'Signed in, but the API is unreachable. Start the local API (port 4000) or point NEXT_PUBLIC_API_URL at a live API, then refresh.'
              : 'Signed in, but the dashboard did not load. Refresh and try again.',
          );
        });
    });
  }, [router]);

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
      setNote('Password reset email sent.');
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
      setNote(
        code === 'auth/user-not-found'
          ? 'If that address has an account, a password reset email was sent.'
          : authNote(code),
      );
    } finally {
      setPending(false);
    }
  }

  if (!ready) {
    return (
      <main className="auth-shell auth-shell-boot">
        <section className="auth-panel auth-panel-boot">
          <h1>{signingUp ? 'Create an account' : 'Sign in'}</h1>
          <p className="note">Opening sign-in.</p>
        </section>
      </main>
    );
  }

  if (user) {
    return (
      <main className="auth-shell auth-shell-boot">
        <section className="auth-panel auth-panel-boot">
          <h1>Opening your dashboard</h1>
          <p>You are signed in as {user.email ?? 'this account'}.</p>
          <p className="note" role="status">
            {note || 'Taking you to the dashboard.'}
          </p>
          <Link className="wax desk-link-btn" href="/desk">
            Go to dashboard
          </Link>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              const auth = firebaseAuth();
              if (auth) void signOut(auth);
            }}
          >
            Sign out
          </button>
        </section>
      </main>
    );
  }

  const emailId = signingUp ? 'signup-email' : 'signin-email';
  const passwordId = signingUp ? 'signup-password' : 'signin-password';

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <h1>{signingUp ? 'Create an account' : 'Sign in'}</h1>
        <p>
          {signingUp
            ? 'Use the Gmail address you want emails to send from. '
            : 'Use the email on your account. '}
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
        <div className="auth-divider" aria-hidden="true">
          <span>or</span>
        </div>
        <button className="google" type="button" disabled={pending} onClick={withGoogle}>
          <GoogleMark />
          <span>{signingUp ? 'Sign up with Google' : 'Sign in with Google'}</span>
        </button>
      </section>
      <AuthStage />
    </main>
  );
}
