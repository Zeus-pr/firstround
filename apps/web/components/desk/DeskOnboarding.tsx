'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { ensureAppSession } from '@/lib/session';
import { acceptCvFile, uploadAndAnalyzeCv, type ReadinessResult } from '@/lib/cv';
import { AnalysisOrbs } from './AnalysisOrbs';
import { ReadinessReveal } from './ReadinessReveal';

type Stage = 'boot' | 'auth' | 'upload' | 'analyzing' | 'result' | 'next';

export function DeskOnboarding() {
  const [user, setUser] = useState<User | null>(null);
  const [stage, setStage] = useState<Stage>('boot');
  const [note, setNote] = useState('');
  const [fileName, setFileName] = useState<string>();
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) {
      setStage('auth');
      setNote('Sign-in is not configured in this build.');
      return;
    }
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      if (!next) {
        setStage('auth');
        return;
      }
      void ensureAppSession(next)
        .then(() =>
          setStage((current) => (current === 'result' || current === 'next' ? current : 'upload')),
        )
        .catch(() => {
          setNote('Signed in, but we could not open your desk yet. Refresh and try again.');
          setStage('upload');
        });
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
    setStage('analyzing');
    try {
      const result = await uploadAndAnalyzeCv(user, file);
      setReadiness(result.readiness);
      setStage('result');
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Analysis did not finish. Try again.');
      setStage('upload');
    }
  }

  if (stage === 'boot') {
    return (
      <main className="desk-shell">
        <p className="note">Opening your desk.</p>
      </main>
    );
  }

  if (stage === 'auth' || !user) {
    return (
      <main className="desk-shell">
        <section className="desk-sheet">
          <h1>Your desk</h1>
          <p className="desk-lead">Sign in to upload a CV and see LetterProof.</p>
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
    <main className="desk-shell">
      <section className="desk-sheet">
        <header className="desk-top">
          <p className="desk-kicker">Signed in as {user.email ?? 'this account'}</p>
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
        </header>

        {stage === 'analyzing' ? <AnalysisOrbs fileName={fileName} /> : null}

        {stage === 'upload' ? (
          <div className="desk-upload">
            <p className="desk-kicker">Step one</p>
            <h1>Place your CV on the desk</h1>
            <p className="desk-lead">
              PDF or Word. We read hard layouts, normalize skills, and score LetterProof. Ordinary
              CVs are coached, not failed.
            </p>
            <input
              ref={inputRef}
              className="desk-file"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
            <button className="wax" type="button" onClick={() => inputRef.current?.click()}>
              Choose CV
            </button>
            <p className="note" role="status">
              {note}
            </p>
          </div>
        ) : null}

        {stage === 'result' && readiness ? (
          <ReadinessReveal
            readiness={readiness}
            onPrimary={() => {
              if (readiness.band === 'ready') setStage('next');
              else {
                setReadiness(null);
                setFileName(undefined);
                setStage('upload');
                setNote(
                  readiness.band === 'supercharge'
                    ? 'Edit the CV, then upload again for a fresh LetterProof.'
                    : 'Strengthen the gaps, then upload again.',
                );
              }
            }}
          />
        ) : null}

        {stage === 'next' ? (
          <div className="desk-upload">
            <p className="desk-kicker">Next</p>
            <h1>Preferences, then Gmail</h1>
            <p className="desk-lead">
              Readiness is set. Next layers add role preferences and Gmail connect so letters leave
              from your inbox.
            </p>
            <Link className="wax desk-link-btn" href="/">
              Back to the letter
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
