'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, type User } from 'firebase/auth';
import { fetchCredits } from '@/lib/cv';
import { firebaseAuth } from '@/lib/firebase';
import { disconnectGmail, fetchGmailStatus, startGmailConnect } from '@/lib/gmail';

type Props = {
  user: User;
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="profile-menu-icon">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProfileMenu({ user }: Props) {
  const path = usePathname();
  const router = useRouter();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [gmailOn, setGmailOn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    void Promise.all([
      fetchCredits(user).catch(() => null),
      fetchGmailStatus(user).catch(() => null),
    ]).then(([balance, gmail]) => {
      if (cancel) return;
      if (balance) setCredits(balance.balance);
      if (gmail) setGmailOn(gmail.connected);
    });
    return () => {
      cancel = true;
    };
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  function openEmails() {
    setOpen(false);
    if (path?.startsWith('/desk')) {
      document
        .getElementById('your-drafts')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    router.push('/desk#your-drafts');
  }

  async function onGmail() {
    setBusy('gmail');
    setNote('');
    try {
      if (gmailOn) {
        await disconnectGmail(user);
        setGmailOn(false);
        window.dispatchEvent(new CustomEvent('firstround:gmail', { detail: { connected: false } }));
        setOpen(false);
        return;
      }
      const { authorizeUrl } = await startGmailConnect(user);
      window.location.assign(authorizeUrl);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Gmail did not update.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="profile-pop"
      ref={rootRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="mast-profile"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        My profile
      </button>
      {open ? (
        <div className="profile-menu" id={menuId} role="menu">
          <p className="profile-menu-kicker">Signed in as</p>
          <p className="profile-menu-email">{user.email}</p>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              if (path?.startsWith('/desk')) {
                document
                  .getElementById('desk-credits')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
              }
              router.push('/desk');
            }}
          >
            <Icon d="M4 7h16M4 12h16M7 17h10" />
            <span>
              Subscription & limits
              {typeof credits === 'number' ? (
                <small>{credits.toLocaleString('en-IN')} credits</small>
              ) : null}
            </span>
          </button>
          <button type="button" role="menuitem" onClick={openEmails}>
            <Icon d="M4 7h16v10H4zM4 7l8 6 8-6" />
            <span>Your emails</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => setNote('Pass it on is not available yet.')}
          >
            <Icon d="M12 6v12M8 10l4-4 4 4M8 14l4 4 4-4" />
            <span>Pass it on</span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy === 'gmail'}
            onClick={() => void onGmail()}
          >
            <Icon d="M8 8l8 8M16 8l-8 8" />
            <span>
              {busy === 'gmail' ? 'Working…' : gmailOn ? 'Disconnect Gmail' : 'Connect Gmail'}
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const auth = firebaseAuth();
              if (auth) void signOut(auth);
            }}
          >
            <Icon d="M10 7H6v10h4M10 12h8M15 9l3 3-3 3" />
            <span>Log out</span>
          </button>
          {note ? <p className="profile-menu-note">{note}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
