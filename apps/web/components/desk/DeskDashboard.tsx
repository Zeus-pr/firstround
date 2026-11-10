'use client';

import type { ReadinessResult } from '@/lib/cv';
import type { ReviewDraft } from '@/lib/jobs';
import { StartMyRound, type RoundPhase } from './StartMyRound';

type Props = {
  email: string | null;
  onboardingStep: string;
  readiness: ReadinessResult | null;
  suggestions: string[];
  creditBalance?: number | null;
  gmailConnected?: boolean;
  gmailEmail?: string | null;
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
  onStartRound: () => void;
};

export function DeskDashboard({
  email,
  onboardingStep,
  readiness,
  suggestions,
  creditBalance,
  gmailConnected = false,
  gmailEmail = null,
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
  onStartRound,
}: Props) {
  const hasReadiness = Boolean(readiness);
  const pendingDrafts = drafts.filter((d) => d.status === 'pending_approval');
  const roundDisabled = !hasReadiness;
  const roundDisabledReason = !hasReadiness ? 'Upload a CV and get a score first.' : undefined;

  return (
    <div className="desk-dash">
      <header className="desk-dash-top">
        <div>
          <p className="desk-kicker">Dashboard</p>
          <p className="desk-lead desk-dash-lead">
            {email ?? 'Signed in'}
            {typeof creditBalance === 'number' ? ` · ${creditBalance} credits` : null}
          </p>
        </div>
        <div className="desk-dash-actions">
          <button className="text-button" type="button" onClick={onOpenCv}>
            {hasReadiness ? 'Update CV' : 'Add CV'}
          </button>
          <button className="text-button" type="button" onClick={onOpenPreferences}>
            Preferences
          </button>
        </div>
      </header>

      <StartMyRound
        disabled={roundDisabled}
        disabledReason={roundDisabledReason}
        phase={roundPhase}
        resultMessage={roundMessage}
        onStart={onStartRound}
      />

      <div className="desk-dash-grid">
        <aside className="desk-rail" aria-label="Sidebar">
          <section className="desk-pane">
            <p className="desk-kicker">CV score</p>
            {readiness?.recommendation ? (
              <>
                <p className="desk-stat">{readiness.total}</p>
                <p className="desk-pane-copy">{readiness.recommendation.headline}</p>
                <button className="text-button" type="button" onClick={onReviewScore}>
                  Review score
                </button>
              </>
            ) : (
              <>
                <p className="desk-pane-copy">No CV uploaded yet.</p>
                <button className="wax desk-rail-btn" type="button" onClick={onOpenCv}>
                  Upload CV
                </button>
              </>
            )}
          </section>

          <section className="desk-pane">
            <p className="desk-kicker">Gmail</p>
            {gmailConnected ? (
              <>
                <p className="desk-pane-copy">Connected{gmailEmail ? ` as ${gmailEmail}` : ''}.</p>
                {onDisconnectGmail ? (
                  <button
                    className="text-button"
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
                <p className="desk-pane-copy">
                  Not connected. Connect the Gmail inbox emails should send from.
                </p>
                {onConnectGmail ? (
                  <button
                    className="wax desk-rail-btn"
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

          <section className="desk-pane">
            <p className="desk-kicker">Today’s drafts</p>
            {pendingDrafts.length === 0 ? (
              <p className="desk-pane-copy">No drafts waiting for approval.</p>
            ) : (
              <ul className="desk-rail-list">
                {pendingDrafts.slice(0, 5).map((draft) => (
                  <li key={draft.id}>
                    <span>Draft · {draft.specificity}</span>
                    {onApproveDraft ? (
                      <button
                        className="text-button"
                        type="button"
                        disabled={draftBusyId === draft.id}
                        onClick={() => onApproveDraft(draft.id)}
                      >
                        {draftBusyId === draft.id ? 'Approving…' : 'Approve'}
                      </button>
                    ) : (
                      <span className="desk-muted">{draft.status}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="desk-pane desk-pane-quiet">
            <p className="desk-kicker">Referrals</p>
            <p className="desk-pane-copy">Referral invites open after Gmail. Not available yet.</p>
          </section>
        </aside>

        <div className="desk-main">
          <section className="desk-pane desk-autopilot">
            <div>
              <p className="desk-kicker">Autopilot</p>
              <p className="desk-pane-copy">
                Off. Connect Gmail and set preferences before drafts send on their own.
              </p>
            </div>
            <button className="desk-ghost" type="button" disabled>
              Pause
            </button>
          </section>

          <section className="desk-pane">
            <p className="desk-kicker">Applications</p>
            <p className="desk-pane-copy">Review drafts, follow-ups, and replies here.</p>
            <ul className="desk-stats" aria-label="Application stats">
              <li>
                <span className="desk-stat">{pendingDrafts.length}</span>
                <span>Pending approvals</span>
              </li>
              <li>
                <span className="desk-stat">
                  {drafts.filter((d) => d.status === 'approved').length}
                </span>
                <span>Approved</span>
              </li>
              <li>
                <span className="desk-stat">0</span>
                <span>Sent</span>
              </li>
              <li>
                <span className="desk-stat">—</span>
                <span>Reply rate</span>
              </li>
            </ul>
          </section>

          {suggestions.length > 0 ? (
            <section className="desk-pane desk-suggestions" aria-label="CV suggestions">
              <div className="desk-suggestions-top">
                <p className="desk-kicker">CV suggestions</p>
                {onDismissSuggestions ? (
                  <button className="text-button" type="button" onClick={onDismissSuggestions}>
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

          <section className="desk-pane">
            <p className="desk-kicker">Replies</p>
            <p className="desk-pane-copy">Nothing to review yet.</p>
          </section>

          <section className="desk-pane desk-log" aria-label="Application log">
            <div className="desk-log-head">
              <span>Company</span>
              <span>Job</span>
              <span>To</span>
              <span>Status</span>
            </div>
            {pendingDrafts.length === 0 ? (
              <p className="desk-log-empty">
                No applications yet. Start my round when you’re ready.
              </p>
            ) : (
              <ul className="desk-log-list">
                {pendingDrafts.slice(0, 8).map((draft) => (
                  <li key={draft.id}>
                    <span>Draft</span>
                    <span>Pending approval</span>
                    <span>—</span>
                    <span>{draft.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
