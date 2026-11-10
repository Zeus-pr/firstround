'use client';

import { Orb } from '@yogesharc/thinking-orbs';

export type RoundPhase =
  'idle' | 'thinking' | 'scanning' | 'scoring' | 'drafting' | 'done' | 'error';

const BEATS: Record<Exclude<RoundPhase, 'idle' | 'done' | 'error'>, string> = {
  thinking: 'Reading your CV…',
  scanning: 'Looking at today’s roles…',
  scoring: 'Checking each role against your CV…',
  drafting: 'Writing the letters…',
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
      ? 'Your 10 are in'
      : phase === 'error'
        ? 'That didn’t finish'
        : running
          ? 'Choosing the right roles'
          : '';

  const lead = running
    ? BEATS[phase]
    : phase === 'done' || phase === 'error'
      ? (resultMessage ??
        (phase === 'done'
          ? 'Read the letters below. Keep the ones you want.'
          : 'Something got stuck. Try once more.'))
      : 'Up to 10 roles today, with a letter for each. That’s the daily limit.';

  const buttonLabel =
    phase === 'done'
      ? 'Look again'
      : phase === 'error'
        ? 'Try again'
        : running
          ? 'Working…'
          : 'Find my 10';

  return (
    <section
      className={`desk-round${phase === 'error' ? ' is-error' : ''}`}
      aria-label="Find my 10"
    >
      <div className="desk-round-copy">
        <p className="desk-kicker">Today</p>
        {title ? <h2 className="desk-round-title">{title}</h2> : null}
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
