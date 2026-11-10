'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { ensureAppSession, type SessionPayload } from '@/lib/session';
import {
  acceptCvFile,
  fetchCredits,
  fetchCvSuggestions,
  fetchLatestReadiness,
  coachReadiness,
  uploadAndAnalyzeCv,
  type ReadinessResult,
} from '@/lib/cv';
import { CvModal, type CvModalStage } from './CvModal';
import { DeskDashboard } from './DeskDashboard';
import { PreferencesModal } from './PreferencesModal';

function needsCvModal(step: string) {
  return step === 'account' || step === 'cv';
}

function isReadiness(value: unknown): value is ReadinessResult {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<ReadinessResult>;
  return (
    typeof row.total === 'number' &&
    typeof row.band === 'string' &&
    Boolean(row.recommendation) &&
    typeof row.recommendation?.headline === 'string' &&
    Array.isArray(row.genuineGaps) &&
    Array.isArray(row.underEmphasised)
  );
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
        setSuggestions([]);
        setReadiness(null);
        return;
      }
      void (async () => {
        try {
          const payload = await ensureAppSession(next);
          const step = payload?.user.onboardingStep ?? 'account';
          setSession(payload?.user ?? null);
          // Show the desk immediately; credits / readiness load in the background.
          setBoot(false);
          if (needsCvModal(step)) {
            setModalOpen(true);
            setModalStage('upload');
          }

          const [credits, latest] = await Promise.all([
            fetchCredits(next).catch(() => null),
            fetchLatestReadiness(next).catch(() => null),
          ]);
          if (credits) setCreditBalance(credits.balance);
          if (isReadiness(latest?.readiness)) {
            setReadiness(coachReadiness(latest.readiness));
            if (latest.cvDocumentId) setCvDocumentId(latest.cvDocumentId);
            if (latest.suggestions?.length) setSuggestions(latest.suggestions);
            if (needsCvModal(step)) {
              setModalOpen(false);
            }
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
    setSuggestions([]);
    setModalStage('analyzing');
    try {
      const result = await uploadAndAnalyzeCv(user, file);
      setCvDocumentId(result.cvDocumentId);
      setReadiness(coachReadiness(result.readiness));
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
      setNote('Upload and analyze this CV again before asking for suggestions.');
      return;
    }
    setPrimaryBusy(true);
    setNote('');
    setModalStage('suggesting');
    try {
      const result = await fetchCvSuggestions(user, cvDocumentId);
      setCvDocumentId(result.cvDocumentId);
      setReadiness(coachReadiness(result.readiness));
      setSuggestions(result.suggestions);
      setCreditBalance(result.creditBalance);
      setSession((prev) => (prev ? { ...prev, onboardingStep: result.onboardingStep } : prev));
      setModalStage('result');
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Suggestions did not finish.');
      setModalStage('result');
    } finally {
      setPrimaryBusy(false);
    }
  }

  if (boot) {
    return (
      <main className="desk-shell desk-shell-center">
        <p className="note desk-boot-copy">Opening your desk.</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="desk-shell desk-shell-center">
        <section className="desk-sheet desk-sheet-center">
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
          setFileName(undefined);
          setModalStage('upload');
          setModalOpen(true);
        }}
        onReviewScore={() => {
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
      {note && !modalOpen ? (
        <p className="note desk-dash-note" role="status">
          {note}
        </p>
      ) : null}

      <CvModal
        open={modalOpen}
        stage={modalStage === 'result' && !readiness ? 'upload' : modalStage}
        fileName={fileName}
        note={note}
        readiness={readiness}
        creditBalance={creditBalance}
        suggestions={suggestions}
        replacing={Boolean(readiness)}
        primaryBusy={primaryBusy}
        onClose={() => {
          if (modalStage === 'analyzing' || modalStage === 'suggesting') return;
          setModalOpen(false);
        }}
        onPickFile={(file) => void onFile(file)}
        onPrimary={() => void onReadinessPrimary()}
        onSkip={() => {
          if (readiness) dockSuggestions(readiness);
        }}
      />

      <PreferencesModal
        open={prefsOpen}
        user={user}
        onClose={() => setPrefsOpen(false)}
        onSaved={(onboardingStep) => {
          setSession((prev) => (prev ? { ...prev, onboardingStep } : prev));
          setPrefsOpen(false);
          setNote('Preferences saved. Gmail connect is next.');
        }}
      />
    </main>
  );
}
