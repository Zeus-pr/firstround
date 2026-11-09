'use client';

import type { ReadinessResult } from '@/lib/cv';

type Props = {
  email: string | null;
  onboardingStep: string;
  readiness: ReadinessResult | null;
  suggestions: string[];
  creditBalance?: number | null;
  onOpenCv: () => void;
  onOpenPreferences: () => void;
  onSignOut: () => void;
  onDismissSuggestions?: () => void;
};

export function DeskDashboard({
  email,
  onboardingStep,
  readiness,
  suggestions,
  creditBalance,
  onOpenCv,
  onOpenPreferences,
  onSignOut,
  onDismissSuggestions,
}: Props) {
  const hasReadiness = Boolean(readiness);
  const gmailReady = onboardingStep === 'done' || onboardingStep === 'gmail';

  return (
    <div className="desk-dash">
      <header className="desk-dash-top">
        <div>
          <p className="desk-kicker">Your desk</p>
          <h1 className="desk-dash-title">firstround</h1>
          <p className="desk-lead desk-dash-lead">
            Signed in as {email ?? 'this account'}
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
          <button className="text-button" type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="desk-add-role" aria-label="Add a role">
        <p className="desk-kicker">Seen a role you want?</p>
        <p className="desk-add-role-copy">Add it and we email the person who can say yes.</p>
        <div className="desk-add-role-row">
          <button className="desk-ghost" type="button" disabled>
            Screenshot
          </button>
          <button className="desk-ghost" type="button" disabled>
            Link or type
          </button>
          <span className="desk-coming">Coming next</span>
        </div>
      </section>

      <div className="desk-dash-grid">
        <aside className="desk-rail" aria-label="Desk side">
          <section className="desk-pane">
            <p className="desk-kicker">LetterProof</p>
            {readiness ? (
              <>
                <p className="desk-stat">{readiness.total}</p>
                <p className="desk-pane-copy">{readiness.recommendation.headline}</p>
                <button className="text-button" type="button" onClick={onOpenCv}>
                  Review score
                </button>
              </>
            ) : (
              <>
                <p className="desk-pane-copy">No CV on the desk yet.</p>
                <button className="wax desk-rail-btn" type="button" onClick={onOpenCv}>
                  Place CV
                </button>
              </>
            )}
          </section>

          <section className="desk-pane">
            <p className="desk-kicker">Gmail</p>
            <p className="desk-pane-copy">
              {gmailReady
                ? 'Connect step is next in onboarding.'
                : 'Not connected. Letters leave from your inbox later.'}
            </p>
          </section>

          <section className="desk-pane">
            <p className="desk-kicker">Your emails</p>
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
            <p className="desk-kicker">Pass it on</p>
            <p className="desk-pane-copy">Referral seats come after Gmail. Not open yet.</p>
          </section>
        </aside>

        <div className="desk-main">
          <section className="desk-pane desk-autopilot">
            <div>
              <p className="desk-kicker">Autopilot</p>
              <p className="desk-pane-copy">
                Paused. Connect Gmail and preferences before drafts run.
              </p>
            </div>
            <button className="desk-ghost" type="button" disabled>
              Pause
            </button>
          </section>

          <section className="desk-pane">
            <p className="desk-kicker">Your outreach</p>
            <p className="desk-pane-copy">Review drafts, track follow-ups, and monitor replies.</p>
            <ul className="desk-stats" aria-label="Outreach stats">
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
                <p className="desk-kicker">Improve before letters</p>
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
            <p className="desk-kicker">Responses</p>
            <p className="desk-pane-copy">Nothing to review yet.</p>
          </section>

          <section className="desk-pane desk-log" aria-label="Outreach log">
            <div className="desk-log-head">
              <span>Company</span>
              <span>Role</span>
              <span>To</span>
              <span>Status</span>
            </div>
            <p className="desk-log-empty">
              No letters on the desk. Add a role when that layer ships.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
