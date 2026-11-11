'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { ensureAppSession, type SessionPayload } from '@/lib/session';
import {
  acceptCvFile,
  fetchCredits,
  fetchCvSuggestions,
  fetchLatestReadiness,
  fetchCvDownload,
  deleteCv,
  coachReadiness,
  uploadAndAnalyzeCv,
  type ReadinessResult,
} from '@/lib/cv';
import { disconnectGmail, fetchGmailStatus, startGmailConnect } from '@/lib/gmail';
import {
  approveDraft,
  cancelDraft,
  fetchTodayDrafts,
  saveDraftBody,
  fetchDeskRun,
  startDeskRun,
  EMPTY_OUTREACH,
  type OutreachStats,
  type ReviewDraft,
  addOpening,
  fetchOutreach,
} from '@/lib/jobs';
import { fetchPreferences, savePreferences } from '@/lib/preferences';
import { CvModal, type CvModalStage } from './CvModal';
import { DeskToast } from './DeskToast';
import { DeskDashboard } from './DeskDashboard';
import { PreferencesModal } from './PreferencesModal';
import type { RoundPhase } from './StartMyRound';

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
  const [cvFilename, setCvFilename] = useState<string | null>(null);
  const [cvBusy, setCvBusy] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStage, setModalStage] = useState<CvModalStage>('upload');
  const [primaryBusy, setPrimaryBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailBusy, setGmailBusy] = useState(false);
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [draftBusyId, setDraftBusyId] = useState<string | null>(null);
  const [letterShuffle, setLetterShuffle] = useState(true);
  const [autopilot, setAutopilot] = useState(false);
  const [outreach, setOutreach] = useState<OutreachStats>(EMPTY_OUTREACH);
  const [addBusy, setAddBusy] = useState(false);
  const [roundPhase, setRoundPhase] = useState<RoundPhase>('idle');
  const [roundMessage, setRoundMessage] = useState<string | undefined>();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const gmail = params.get('gmail');
    if (!gmail) return;
    if (gmail === 'connected') setNote('Gmail connected.');
    if (gmail === 'error') {
      const reason = params.get('reason');
      setNote(reason ? `Gmail connect failed: ${reason}` : 'Gmail connect failed. Try again.');
    }
    window.history.replaceState({}, '', '/desk');
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem('fr-open-preferences') === '1') {
      sessionStorage.removeItem('fr-open-preferences');
      setPrefsOpen(true);
    }
    const openPrefs = () => setPrefsOpen(true);
    const onGmail = (event: Event) => {
      const connected = (event as CustomEvent<{ connected?: boolean }>).detail?.connected;
      if (typeof connected === 'boolean') setGmailConnected(connected);
    };
    window.addEventListener('firstround:preferences', openPrefs);
    window.addEventListener('firstround:gmail', onGmail);
    return () => {
      window.removeEventListener('firstround:preferences', openPrefs);
      window.removeEventListener('firstround:gmail', onGmail);
    };
  }, []);

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
        setGmailConnected(false);
        setDrafts([]);
        setOutreach(EMPTY_OUTREACH);
        setAutopilot(false);
        setRoundPhase('idle');
        setRoundMessage(undefined);
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

          const [credits, latest, gmail, todayDrafts, prefs, outreachStats] = await Promise.all([
            fetchCredits(next).catch(() => null),
            fetchLatestReadiness(next).catch(() => null),
            fetchGmailStatus(next).catch(() => null),
            fetchTodayDrafts(next).catch(() => []),
            fetchPreferences(next).catch(() => null),
            fetchOutreach(next).catch(() => EMPTY_OUTREACH),
          ]);
          setDrafts(todayDrafts);
          setOutreach(outreachStats);
          if (prefs) {
            setLetterShuffle(prefs.preferences.criteria.letterShuffle !== false);
            setAutopilot(prefs.preferences.criteria.autopilot === true);
          }
          if (credits) setCreditBalance(credits.balance);
          if (gmail) {
            setGmailConnected(gmail.connected);
            if (gmail.onboardingStep) {
              setSession((prev) =>
                prev ? { ...prev, onboardingStep: gmail.onboardingStep } : prev,
              );
            }
          }
          if (isReadiness(latest?.readiness)) {
            setReadiness(coachReadiness(latest.readiness));
            if (latest.cvDocumentId) setCvDocumentId(latest.cvDocumentId);
            setCvFilename(latest.cvFilename ?? null);
            if (latest.suggestions?.length) setSuggestions(latest.suggestions);
            if (needsCvModal(step)) {
              setModalOpen(false);
            }
          }
        } catch {
          setNote('Signed in, but the dashboard did not load. Refresh and try again.');
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
        <p className="note desk-boot-copy">Opening your dashboard.</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="desk-shell desk-shell-center">
        <section className="desk-sheet desk-sheet-center">
          <h1>Dashboard</h1>
          <p className="desk-lead">Sign in to upload a CV and see your score.</p>
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
        hello={user.email?.split('@')[0] || null}
        onboardingStep={session?.onboardingStep ?? 'account'}
        readiness={readiness}
        suggestions={modalOpen ? [] : suggestions}
        creditBalance={creditBalance}
        gmailConnected={gmailConnected}
        gmailBusy={gmailBusy}
        drafts={drafts}
        draftBusyId={draftBusyId}
        roundPhase={roundPhase}
        roundMessage={roundMessage}
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
        outreach={outreach}
        autopilot={autopilot}
        onAutopilot={(on) => {
          setAutopilot(on);
          if (!user) return;
          void fetchPreferences(user)
            .then((payload) =>
              savePreferences(user, {
                ...payload.preferences,
                criteria: { ...payload.preferences.criteria, autopilot: on },
              }),
            )
            .catch(() => {
              setAutopilot(!on);
              setNote('Could not save autopilot.');
            });
        }}
        addBusy={addBusy}
        onAddLink={(url) => {
          if (!user || addBusy) return;
          setAddBusy(true);
          setNote('');
          void addOpening(user, { url })
            .then(async (result) => {
              setDrafts(await fetchTodayDrafts(user).catch(() => []));
              setOutreach(await fetchOutreach(user).catch(() => outreach));
              setNote(result.message);
            })
            .catch((error) =>
              setNote(error instanceof Error ? error.message : 'Could not add that role.'),
            )
            .finally(() => setAddBusy(false));
        }}
        onAddScreenshot={(file) => {
          if (!user || addBusy) return;
          if (file.size > 4_000_000) {
            setNote('That screenshot is too large. Use one under 4 MB.');
            return;
          }
          const type =
            file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
          setAddBusy(true);
          setNote('');
          const reader = new FileReader();
          reader.onload = () => {
            const raw = typeof reader.result === 'string' ? reader.result : '';
            const imageBase64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
            void addOpening(user, { imageBase64, imageType: type })
              .then(async (result) => {
                setDrafts(await fetchTodayDrafts(user).catch(() => []));
                setOutreach(await fetchOutreach(user).catch(() => outreach));
                setNote(result.message);
              })
              .catch((error) =>
                setNote(error instanceof Error ? error.message : 'Could not read that screenshot.'),
              )
              .finally(() => setAddBusy(false));
          };
          reader.onerror = () => {
            setAddBusy(false);
            setNote('Could not read that screenshot.');
          };
          reader.readAsDataURL(file);
        }}
        cvFilename={cvFilename}
        onDownloadCv={() => {
          if (!user || !cvDocumentId) return;
          void fetchCvDownload(user, cvDocumentId)
            .then((file) => {
              window.open(file.downloadUrl, '_blank', 'noopener,noreferrer');
            })
            .catch((error) => {
              setNote(error instanceof Error ? error.message : 'Could not download the CV.');
            });
        }}
        cvBusy={cvBusy}
        onDeleteCv={() => {
          if (!user || !cvDocumentId || cvBusy) return;
          if (!window.confirm('Delete this CV and its score?')) return;
          setCvBusy(true);
          setNote('');
          void deleteCv(user, cvDocumentId)
            .then(() => fetchLatestReadiness(user))
            .then((latest) => {
              if (isReadiness(latest.readiness)) {
                setReadiness(coachReadiness(latest.readiness));
                setCvDocumentId(latest.cvDocumentId);
                setCvFilename(latest.cvFilename ?? null);
                setSuggestions(latest.suggestions ?? []);
              } else {
                setReadiness(null);
                setCvDocumentId(null);
                setCvFilename(null);
                setSuggestions([]);
                setFileName(undefined);
                setSession((prev) => (prev ? { ...prev, onboardingStep: 'account' } : prev));
              }
              setModalOpen(false);
              setNote('CV deleted.');
            })
            .catch((error) => {
              setNote(error instanceof Error ? error.message : 'Could not delete the CV.');
            })
            .finally(() => setCvBusy(false));
        }}
        onStartRound={() => {
          if (!user || (roundPhase !== 'idle' && roundPhase !== 'done' && roundPhase !== 'error')) {
            return;
          }
          setNote('');
          setRoundMessage(undefined);
          const phases: RoundPhase[] = ['thinking', 'scanning', 'scoring', 'drafting'];
          let i = 0;
          setRoundPhase(phases[0]!);
          const timer = window.setInterval(() => {
            i += 1;
            if (i < phases.length) setRoundPhase(phases[i]!);
          }, 900);
          void startDeskRun(user)
            .then(async (result) => {
              window.clearInterval(timer);
              if (result.status === 'selecting' && result.runId) {
                setRoundPhase('scoring');
                setRoundMessage(result.message);
                setNote(result.message);
                const runId = result.runId;
                const poll = window.setInterval(() => {
                  void fetchDeskRun(user, runId)
                    .then(async (state) => {
                      if (state.status === 'selecting') return;
                      window.clearInterval(poll);
                      setRoundPhase(state.status === 'failed' ? 'error' : 'done');
                      setRoundMessage(state.message);
                      setDrafts(await fetchTodayDrafts(user).catch(() => []));
                      setNote(state.message);
                    })
                    .catch(() => {
                      window.clearInterval(poll);
                    });
                }, 8000);
                return;
              }
              setRoundPhase('done');
              setRoundMessage(result.message);
              setDrafts(await fetchTodayDrafts(user).catch(() => []));
              setNote(result.message);
            })
            .catch((error) => {
              window.clearInterval(timer);
              setRoundPhase('error');
              const message =
                error instanceof Error ? error.message : 'Could not start your round.';
              setRoundMessage(message);
              setNote(message);
            });
        }}
        letterShuffle={letterShuffle}
        onLetterShuffle={(on) => {
          setLetterShuffle(on);
          if (!user) return;
          void fetchPreferences(user)
            .then((payload) =>
              savePreferences(user, {
                ...payload.preferences,
                criteria: { ...payload.preferences.criteria, letterShuffle: on },
              }),
            )
            .catch(() => setNote('Could not save smart shuffle.'));
        }}
        onSaveDraft={(draftId, subject, body) => {
          if (!user) return;
          setDraftBusyId(draftId);
          void saveDraftBody(user, draftId, body, subject)
            .then(async () => {
              setDrafts(await fetchTodayDrafts(user).catch(() => []));
              setNote('Letter saved.');
            })
            .catch((error) =>
              setNote(error instanceof Error ? error.message : 'Could not save the letter.'),
            )
            .finally(() => setDraftBusyId(null));
        }}
        onCancelDraft={(draftId) => {
          if (!user) return;
          setDraftBusyId(draftId);
          void cancelDraft(user, draftId)
            .then(async () => {
              setDrafts(await fetchTodayDrafts(user).catch(() => []));
              setNote('Letter cancelled.');
            })
            .catch((error) =>
              setNote(error instanceof Error ? error.message : 'Could not cancel the letter.'),
            )
            .finally(() => setDraftBusyId(null));
        }}
        onApproveDraft={(draftId) => {
          if (!user) return;
          setDraftBusyId(draftId);
          setNote('');
          void approveDraft(user, draftId)
            .then(async () => {
              setDrafts(await fetchTodayDrafts(user).catch(() => []));
              setNote('Draft approved.');
            })
            .catch((error) => {
              setNote(error instanceof Error ? error.message : 'Could not approve draft.');
            })
            .finally(() => setDraftBusyId(null));
        }}
        onConnectGmail={() => {
          if (!user) return;
          setGmailBusy(true);
          setNote('');
          void startGmailConnect(user)
            .then(({ authorizeUrl }) => {
              window.location.assign(authorizeUrl);
            })
            .catch((error) => {
              setNote(error instanceof Error ? error.message : 'Could not start Gmail connect.');
              setGmailBusy(false);
            });
        }}
        onDisconnectGmail={() => {
          if (!user) return;
          setGmailBusy(true);
          setNote('');
          void disconnectGmail(user)
            .then((status) => {
              setGmailConnected(false);
              setSession((prev) =>
                prev ? { ...prev, onboardingStep: status.onboardingStep } : prev,
              );
              setNote('Gmail disconnected.');
            })
            .catch((error) => {
              setNote(error instanceof Error ? error.message : 'Could not disconnect Gmail.');
            })
            .finally(() => setGmailBusy(false));
        }}
        onDismissSuggestions={() => setSuggestions([])}
      />
      {note && !modalOpen ? (
        <DeskToast key={note} message={note} onDone={() => setNote('')} />
      ) : null}

      <CvModal
        open={modalOpen}
        stage={modalStage === 'result' && !readiness ? 'upload' : modalStage}
        fileName={fileName}
        note={note}
        readiness={readiness}
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
          setNote('Preferences saved. Connect Gmail next.');
        }}
      />
    </main>
  );
}
