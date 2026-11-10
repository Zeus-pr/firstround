'use client';

import type { ReadinessResult } from '@/lib/cv';

type Props = {
  email: string | null;
  onboardingStep: string;
  readiness: ReadinessResult | null;
  suggestions: string[];
  creditBalance?: number | null;
  onOpenCv: () => void;
  onReviewScore: () => void;
  onOpenPreferences: () => void;
  onDismissSuggestions?: () => void;
};

export function DeskDashboard({
  email,
  onboardingStep,
  readiness,
  suggestions,
  creditBalance,
  onOpenCv,
  onReviewScore,
  onOpenPreferences,
  onDismissSuggestions,
}: Props) {
  const hasReadiness = Boolean(readiness);
  const gmailReady = onboardingStep === 'done' || onboardingStep === 'gmail';

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
            <p className="desk-pane-copy">
              {gmailReady
                ? 'Connect Gmail next so emails can send from your inbox.'
                : 'Not connected. Emails will send from your Gmail after you connect.'}
            </p>
          </section>

          <section className="desk-pane">
            <p className="desk-kicker">Email drafts</p>
            <ul className="desk-rail-list">
              <li>
                <span>Subject lines</span>
                <span className="desk-muted">Empty</span>
              </li>
              <li>
                <span>First email</span>
                <span className="desk-muted">Empty</span>
              </li>
              <li>
                <span>About me</span>
                <span className="desk-muted">Empty</span>
              </li>
              <li>
                <span>Follow-ups</span>
                <span className="desk-muted">3 planned later</span>
              </li>
            </ul>
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
            <p className="desk-kicker">Job applications</p>
            <p className="desk-pane-copy">Review drafts, follow-ups, and replies here.</p>
            <ul className="desk-stats" aria-label="Application stats">
              <li>
                <span className="desk-stat">0</span>
                <span>Companies contacted</span>
              </li>
              <li>
                <span className="desk-stat">0</span>
                <span>Emails sent</span>
              </li>
              <li>
                <span className="desk-stat">0</span>
                <span>Companies replied</span>
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
            <p className="desk-log-empty">No emails yet. Add a job when that feature ships.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
