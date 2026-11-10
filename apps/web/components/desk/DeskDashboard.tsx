'use client';

import type { ReadinessResult } from '@/lib/cv';
import type { CorpusStatus, ReviewDraft } from '@/lib/jobs';

type Props = {
  email: string | null;
  onboardingStep: string;
  readiness: ReadinessResult | null;
  suggestions: string[];
  creditBalance?: number | null;
  gmailConnected?: boolean;
  gmailEmail?: string | null;
  gmailBusy?: boolean;
  corpus?: CorpusStatus | null;
  drafts?: ReviewDraft[];
  draftBusyId?: string | null;
  onOpenCv: () => void;
  onReviewScore: () => void;
  onOpenPreferences: () => void;
  onConnectGmail?: () => void;
  onDisconnectGmail?: () => void;
  onDismissSuggestions?: () => void;
  onApproveDraft?: (draftId: string) => void;
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
  corpus = null,
  drafts = [],
  draftBusyId = null,
  onOpenCv,
  onReviewScore,
  onOpenPreferences,
  onConnectGmail,
  onDisconnectGmail,
  onDismissSuggestions,
  onApproveDraft,
}: Props) {
  const hasReadiness = Boolean(readiness);
  const pendingDrafts = drafts.filter((d) => d.status === 'pending_approval');

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

      <section className="desk-add-role" aria-label="Add a job">
        <p className="desk-kicker">Found a job you want?</p>
        <p className="desk-add-role-copy">
          Add the posting. We draft an email to the recruiter or hiring manager.
        </p>
        <div className="desk-add-role-row">
          <button className="desk-ghost" type="button" disabled>
            Screenshot
          </button>
          <button className="desk-ghost" type="button" disabled>
            Link or paste
          </button>
          <span className="desk-coming">Coming next</span>
        </div>
      </section>

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
                Off. Connect Gmail and set preferences before drafts run.
              </p>
            </div>
            <button className="desk-ghost" type="button" disabled>
              Pause
            </button>
          </section>

          <section className="desk-pane">
            <p className="desk-kicker">Job corpus</p>
            <p className="desk-pane-copy">
              {corpus
                ? `${corpus.counts.canonical} canonical · ${corpus.counts.quarantined} quarantined · ${corpus.counts.stale} stale${corpus.apifyConfigured ? '' : ' · Apify not configured'}`
                : 'Corpus status loads after sign-in.'}
            </p>
            <ul className="desk-stats" aria-label="Corpus and draft stats">
              <li>
                <span className="desk-stat">{corpus?.counts.canonical ?? 0}</span>
                <span>Jobs in corpus</span>
              </li>
              <li>
                <span className="desk-stat">{pendingDrafts.length}</span>
                <span>Pending approvals</span>
              </li>
              <li>
                <span className="desk-stat">
                  {corpus?.sources.filter((s) => s.enabled && !s.killSwitch).length ?? 0}
                </span>
                <span>Sources on</span>
              </li>
              <li>
                <span className="desk-stat">{corpus?.apifyConfigured ? 'On' : '—'}</span>
                <span>Apify</span>
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
            <p className="desk-log-empty">No emails yet. Add a job when that feature ships.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
