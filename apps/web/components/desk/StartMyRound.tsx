'use client';

import { Orb } from '@yogesharc/thinking-orbs';

export type RoundPhase =
  'idle' | 'thinking' | 'scanning' | 'scoring' | 'drafting' | 'done' | 'error';

const BEATS: Record<Exclude<RoundPhase, 'idle' | 'done' | 'error'>, string> = {
  thinking: 'Reading your CV and preferences…',
  scanning: 'Scanning today’s openings…',
  scoring: 'Scoring the strongest fits…',
  drafting: 'Preparing letters for review…',
};

type Props = {
  disabled?: boolean;
  disabledReason?: string;
  phase: RoundPhase;
  resultMessage?: string;
  onStart: () => void;
};

export function StartMyRound({
  disabled = false,
  disabledReason,
  phase,
  resultMessage,
  onStart,
}: Props) {
  const running =
    phase === 'thinking' || phase === 'scanning' || phase === 'scoring' || phase === 'drafting';

  const title =
    phase === 'done'
      ? 'Round ready'
      : phase === 'error'
        ? 'Couldn’t finish'
        : running
          ? 'Working on it'
          : 'Start my round';

  const lead = running
    ? BEATS[phase]
    : phase === 'done' || phase === 'error'
      ? (resultMessage ??
        (phase === 'done' ? 'Drafts are ready to review.' : 'Try again in a moment.'))
      : 'We match your CV to today’s openings and draft letters for you to approve.';

  const buttonLabel =
    phase === 'done'
      ? 'Run again'
      : phase === 'error'
        ? 'Try again'
        : running
          ? 'Working…'
          : 'Start my round';

  return (
    <section
      className={`desk-round${phase === 'error' ? ' is-error' : ''}`}
      aria-label="Start my round"
    >
      <div className="desk-round-copy">
        <p className="desk-kicker">Your round</p>
        <h2 className="desk-round-title">{title}</h2>
        <p className="desk-round-lead" aria-live="polite">
          {lead}
        </p>
      </div>

      <div className="desk-round-action">
        <button
          type="button"
          className="wax desk-round-cta"
          disabled={disabled || running}
          aria-busy={running}
          onClick={onStart}
        >
          {running ? (
            <span className="desk-round-orb" aria-hidden="true">
              <Orb state="working" size={22} label={lead} />
            </span>
          ) : null}
          <span>{buttonLabel}</span>
        </button>
        {disabled && disabledReason && phase === 'idle' ? (
          <p className="desk-round-hint">{disabledReason}</p>
        ) : null}
      </div>
    </section>
  );
}
