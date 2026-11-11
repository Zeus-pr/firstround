'use client';

import { useState } from 'react';
import type { ReadinessResult } from '@/lib/cv';
import type { OutreachStats, ReviewDraft } from '@/lib/jobs';
import { EMPTY_OUTREACH } from '@/lib/jobs';
import { AddOpening } from './AddOpening';
import { ChoosingOrb } from './ChoosingOrb';
import { DraftLetters } from './DraftLetters';
import { ScoreName } from './ScoreName';
import { StartMyRound, type RoundPhase } from './StartMyRound';

type Props = {
  onboardingStep: string;
  readiness: ReadinessResult | null;
  suggestions: string[];
  creditBalance?: number | null;
  gmailConnected?: boolean;
  gmailBusy?: boolean;
  drafts?: ReviewDraft[];
  draftBusyId?: string | null;
  roundPhase: RoundPhase;
  roundMessage?: string;
  onOpenCv: () => void;
  onReviewScore: () => void;
  onOpenPreferences: () => void;
  onConnectGmail?: () => void;
  onDisconnectGmail?: () => void;
  onDismissSuggestions?: () => void;
  onApproveDraft?: (draftId: string) => void;
  onSaveDraft?: (draftId: string, subject: string, body: string) => void;
  onCancelDraft?: (draftId: string) => void;
  letterShuffle?: boolean;
  onLetterShuffle?: (on: boolean) => void;
  onStartRound: () => void;
  cvFilename?: string | null;
  onDownloadCv?: () => void;
  onDeleteCv?: () => void;
  cvBusy?: boolean;
  outreach?: OutreachStats;
  autopilot?: boolean;
  onAutopilot?: (on: boolean) => void;
  addBusy?: boolean;
  onAddLink?: (url: string) => void;
  onAddScreenshot?: (file: File) => void;
};

export function DeskDashboard({
  onboardingStep,
  readiness,
  suggestions,
  creditBalance,
  gmailConnected = false,
  gmailBusy = false,
  drafts = [],
  draftBusyId = null,
  roundPhase,
  roundMessage,
  onOpenCv,
  onReviewScore,
  onOpenPreferences,
  onConnectGmail,
  onDisconnectGmail,
  onDismissSuggestions,
  onApproveDraft,
  onSaveDraft,
  onCancelDraft,
  letterShuffle = true,
  onLetterShuffle,
  onStartRound,
  cvFilename = null,
  onDownloadCv,
  onDeleteCv,
  cvBusy = false,
  outreach = EMPTY_OUTREACH,
  autopilot = false,
  onAutopilot,
  addBusy = false,
  onAddLink,
  onAddScreenshot,
}: Props) {
  const [scoreOpen, setScoreOpen] = useState(false);
  const hasReadiness = Boolean(readiness);
  const choosing =
    roundPhase === 'thinking' ||
    roundPhase === 'scanning' ||
    roundPhase === 'scoring' ||
    roundPhase === 'drafting';
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const heldToday = drafts.filter((draft) => {
    if (draft.status !== 'pending_approval' && draft.status !== 'approved') return false;
    if (!draft.createdAt) return draft.status === 'pending_approval';
    const key = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(draft.createdAt));
    return key === todayKey;
  }).length;
  const roundDisabled = !hasReadiness;

  const replyRate =
    outreach.emailsSent > 0
      ? `${outreach.replyRate}%`
      : outreach.companiesReplied > 0
        ? '100%'
        : '0%';

  return (
    <div className="desk-dash">
      <div className="desk-dash-grid">
        <aside className="desk-rail" aria-label="Sidebar">
          <StartMyRound
            disabled={roundDisabled}
            heldToday={heldToday}
            phase={roundPhase}
            resultMessage={roundMessage}
            onStart={onStartRound}
          />

          <section className="desk-pane desk-autopilot">
            <div>
              <h2 className="desk-pane-title">Autopilot</h2>
              <p className="desk-pane-copy">
                {autopilot
                  ? 'On. We send the letters the next day.'
                  : 'Off. Turn it on and we send the letters the next day.'}
              </p>
            </div>
            <button
              type="button"
              className={`desk-toggle${autopilot ? ' is-on' : ''}`}
              aria-pressed={autopilot}
              aria-label={autopilot ? 'Turn autopilot off' : 'Turn autopilot on'}
              onClick={() => onAutopilot?.(!autopilot)}
            >
              <span className="desk-toggle-knob" />
            </button>
          </section>

          <section className="desk-pane">
            <h2 className="desk-pane-title">Gmail</h2>
            {gmailConnected ? (
              <>
                <p className="desk-pane-copy">Connected. Letters send from this inbox.</p>
                {onDisconnectGmail ? (
                  <button
                    className="desk-btn"
                    type="button"
                    disabled={gmailBusy}
                    onClick={onDisconnectGmail}
                  >
                    {gmailBusy ? 'Working…' : 'Disconnect'}
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <p className="desk-pane-copy">Not connected. Letters send from this inbox.</p>
                {onConnectGmail ? (
                  <button
                    className="wax desk-btn"
                    type="button"
                    disabled={gmailBusy || onboardingStep === 'account' || onboardingStep === 'cv'}
                    onClick={onConnectGmail}
                  >
                    {gmailBusy ? 'Opening Google…' : 'Connect Gmail'}
                  </button>
                ) : null}
              </>
            )}
          </section>

          <section className="desk-pane desk-pane-quiet">
            <h2 className="desk-pane-title">Referrals</h2>
            <p className="desk-pane-copy">Not available yet.</p>
          </section>

          <section className={`desk-pane desk-score-pane${scoreOpen ? ' is-open' : ''}`}>
            <button
              type="button"
              className="desk-score-toggle"
              aria-expanded={scoreOpen}
              onClick={() => setScoreOpen((open) => !open)}
            >
              <span className="desk-score-toggle-main">
                <ScoreName />
                {readiness?.recommendation ? (
                  <span className="desk-score-mini">{readiness.total}</span>
                ) : (
                  <span className="desk-pane-file">No CV</span>
                )}
              </span>
              <span className="desk-letter-chevron" aria-hidden="true" />
            </button>
            <div className="desk-score-fold">
              <div className="desk-score-fold-inner">
                {readiness?.recommendation ? (
                  <>
                    <p className="desk-pane-copy">
                      {readiness.total >= 75
                        ? 'Good enough to start. A stronger CV gets more replies.'
                        : 'You can keep going. A stronger CV gets more replies.'}
                    </p>
                    {cvFilename ? <p className="desk-pane-file">{cvFilename}</p> : null}
                    {typeof creditBalance === 'number' ? (
                      <p className="desk-pane-file">{creditBalance} credits</p>
                    ) : null}
                    <div className="desk-score-actions">
                      <button className="desk-btn" type="button" onClick={onOpenCv}>
                        Update CV
                      </button>
                      {onDownloadCv ? (
                        <button className="desk-btn" type="button" onClick={onDownloadCv}>
                          Download CV
                        </button>
                      ) : null}
                      <button className="desk-btn" type="button" onClick={onOpenPreferences}>
                        Preferences
                      </button>
                      <button className="desk-btn" type="button" onClick={onReviewScore}>
                        See the breakdown
                      </button>
                      {onDeleteCv ? (
                        <button
                          className="desk-btn"
                          type="button"
                          disabled={cvBusy}
                          onClick={onDeleteCv}
                        >
                          {cvBusy ? 'Deleting…' : 'Delete CV'}
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="desk-score-actions">
                    <button className="wax desk-btn" type="button" onClick={onOpenCv}>
                      Upload CV
                    </button>
                    <button className="desk-btn" type="button" onClick={onOpenPreferences}>
                      Preferences
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </aside>

        <div className="desk-main">
          <section className="desk-outreach" aria-label="Your outreach">
            <h2 className="desk-pane-title">Your outreach</h2>
            <ul className="desk-outreach-grid">
              <li>
                <span className="desk-stat">{outreach.companiesContacted}</span>
                <span>Companies contacted</span>
              </li>
              <li>
                <span className="desk-stat">{outreach.emailsSent}</span>
                <span>Emails sent</span>
              </li>
              <li>
                <span className="desk-stat">{outreach.companiesReplied}</span>
                <span>Companies replied</span>
              </li>
              <li>
                <span className="desk-stat">{replyRate}</span>
                <span>Reply rate</span>
              </li>
            </ul>
          </section>

          {onAddLink && onAddScreenshot ? (
            <AddOpening busy={addBusy} onLink={onAddLink} onScreenshot={onAddScreenshot} />
          ) : null}

          <section className="desk-pane desk-letters-pane" aria-label="Your drafts">
            <h2 className="desk-pane-title">Your drafts</h2>
            {choosing ? <ChoosingOrb /> : null}
            <DraftLetters
              hideEmpty={choosing}
              drafts={drafts}
              busyId={draftBusyId}
              shuffle={letterShuffle}
              onShuffle={onLetterShuffle}
              onApprove={onApproveDraft}
              onSave={onSaveDraft}
              onCancel={onCancelDraft}
            />
          </section>

          <section className="desk-pane" aria-label="Replies">
            <h2 className="desk-pane-title">Replies</h2>
            <p className="desk-pane-copy">Nothing to review yet.</p>
          </section>

          {suggestions.length > 0 ? (
            <section className="desk-pane desk-suggestions" aria-label="CV suggestions">
              <div className="desk-suggestions-top">
                <h2 className="desk-pane-title">CV suggestions</h2>
                {onDismissSuggestions ? (
                  <button
                    className="desk-btn desk-btn-fit"
                    type="button"
                    onClick={onDismissSuggestions}
                  >
                    Dismiss
                  </button>
                ) : null}
              </div>
              <ul>
                {suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
