'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { ensureAppSession, type SessionPayload } from '@/lib/session';
import {
  acceptCvFile,
  fetchCredits,
  fetchLatestReadiness,
  superchargeCv,
  uploadAndAnalyzeCv,
  type ReadinessResult,
} from '@/lib/cv';
import { CvModal, type CvModalStage } from './CvModal';
import { DeskDashboard } from './DeskDashboard';

function needsCvModal(step: string) {
  return step === 'account' || step === 'cv';
}

function suggestionLines(readiness: ReadinessResult): string[] {
  const soft = [...readiness.genuineGaps, ...readiness.underEmphasised].filter(Boolean);
  if (soft.length > 0) return soft.slice(0, 8);
  return readiness.gaps.slice(0, 8);
}

export function DeskOnboarding() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<SessionPayload['user'] | null>(null);
  const [boot, setBoot] = useState(true);
  const [note, setNote] = useState('');
  const [fileName, setFileName] = useState<string>();
  const [cvDocumentId, setCvDocumentId] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [rewrittenText, setRewrittenText] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStage, setModalStage] = useState<CvModalStage>('upload');
  const [primaryBusy, setPrimaryBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [prefsOpen, setPrefsOpen] = useState(false);

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) {
      setBoot(false);
      setNote('Sign-in is not configured in this build.');
      return;
    }
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      if (!next) {
        setSession(null);
        setBoot(false);
        setModalOpen(false);
        setCreditBalance(null);
        setCvDocumentId(null);
        setRewrittenText(null);
        return;
      }
      void (async () => {
        try {
          const payload = await ensureAppSession(next);
          const step = payload?.user.onboardingStep ?? 'account';
          setSession(payload?.user ?? null);
          const [credits, latest] = await Promise.all([
            fetchCredits(next).catch(() => null),
            fetchLatestReadiness(next).catch(() => null),
          ]);
          if (credits) setCreditBalance(credits.balance);
          if (latest?.readiness) setReadiness(latest.readiness);
          setBoot(false);
          if (needsCvModal(step) && !latest?.readiness) {
            setModalOpen(true);
            setModalStage('upload');
          }
        } catch {
          setNote('Signed in, but we could not open your desk yet. Refresh and try again.');
          setBoot(false);
          setModalOpen(true);
          setModalStage('upload');
        }
      })();
    });
  }, []);

  async function onFile(file: File | undefined) {
    if (!file || !user) return;
    const problem = acceptCvFile(file);
    if (problem) {
      setNote(problem);
      return;
    }
    setNote('');
    setFileName(file.name);
    setRewrittenText(null);
    setModalStage('analyzing');
    try {
      const result = await uploadAndAnalyzeCv(user, file);
      setCvDocumentId(result.cvDocumentId);
      setReadiness(result.readiness);
      setSession((prev) => (prev ? { ...prev, onboardingStep: result.onboardingStep } : prev));
      setModalStage('result');
      const credits = await fetchCredits(user).catch(() => null);
      if (credits) setCreditBalance(credits.balance);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Analysis did not finish. Try again.');
      setModalStage('upload');
    }
  }

  function dockSuggestions(next: ReadinessResult) {
    setSuggestions(suggestionLines(next));
    setModalOpen(false);
  }

  async function onReadinessPrimary() {
    if (!readiness || !user) return;
    if (readiness.band === 'ready') {
      setModalOpen(false);
      setSuggestions([]);
      setPrefsOpen(true);
      return;
    }
    if (readiness.band === 'strengthen') {
      dockSuggestions(readiness);
      return;
    }
    if (readiness.band !== 'supercharge') return;
    if (!cvDocumentId) {
      setNote('Upload and analyze this CV again before Supercharge.');
      return;
    }
    setPrimaryBusy(true);
    setNote('');
    setModalStage('supercharging');
    try {
      const result = await superchargeCv(user, cvDocumentId);
      setCvDocumentId(result.cvDocumentId);
      setReadiness(result.readiness);
      setRewrittenText(result.rewrittenText);
      setCreditBalance(result.creditBalance);
      setSession((prev) => (prev ? { ...prev, onboardingStep: result.onboardingStep } : prev));
      setSuggestions([]);
      setModalStage('result');
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Supercharge did not finish.');
      setModalStage('result');
    } finally {
      setPrimaryBusy(false);
    }
  }

  if (boot) {
    return (
      <main className="desk-shell">
        <p className="note">Opening your desk.</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="desk-shell">
        <section className="desk-sheet">
          <h1>Your desk</h1>
          <p className="desk-lead">Sign in to open the desk and LetterProof.</p>
          <p className="note" role="status">
            {note}
          </p>
          <Link className="wax desk-link-btn" href="/login">
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="desk-shell desk-shell-dash">
      <DeskDashboard
        email={user.email}
        onboardingStep={session?.onboardingStep ?? 'account'}
        readiness={readiness}
        suggestions={suggestions}
        creditBalance={creditBalance}
        onOpenCv={() => {
          setNote('');
          setModalStage(readiness ? 'result' : 'upload');
          setModalOpen(true);
        }}
        onOpenPreferences={() => setPrefsOpen(true)}
        onSignOut={() => {
          const auth = firebaseAuth();
          if (auth) void signOut(auth);
        }}
        onDismissSuggestions={() => setSuggestions([])}
      />

      <CvModal
        open={modalOpen}
        stage={modalStage === 'result' && !readiness ? 'upload' : modalStage}
        fileName={fileName}
        note={note}
        readiness={readiness}
        creditBalance={creditBalance}
        rewrittenText={rewrittenText}
        primaryBusy={primaryBusy}
        onClose={() => {
          if (modalStage === 'analyzing' || modalStage === 'supercharging') return;
          setModalOpen(false);
        }}
        onPickFile={(file) => void onFile(file)}
        onPrimary={() => void onReadinessPrimary()}
        onSkip={() => {
          if (readiness) dockSuggestions(readiness);
        }}
      />

      {prefsOpen ? (
        <div className="desk-modal-root" role="presentation">
          <button
            className="desk-modal-scrim"
            type="button"
            aria-label="Close preferences"
            onClick={() => setPrefsOpen(false)}
          />
          <div className="desk-modal" role="dialog" aria-modal="true" aria-label="Preferences">
            <header className="desk-modal-top">
              <p className="desk-kicker">Preferences</p>
              <button className="text-button" type="button" onClick={() => setPrefsOpen(false)}>
                Close
              </button>
            </header>
            <p className="desk-lead">
              Role families, locations, and level land in the next preferences slice. The desk seat
              is ready.
            </p>
            <button className="wax" type="button" onClick={() => setPrefsOpen(false)}>
              Back to desk
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
