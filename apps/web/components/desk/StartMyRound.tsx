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
  heldToday?: number;
  phase: RoundPhase;
  resultMessage?: string;
  onStart: () => void;
  inline?: boolean;
};

export function StartMyRound({
  disabled = false,
  disabledReason,
  heldToday = 0,
  phase,
  resultMessage,
  onStart,
  inline = false,
}: Props) {
  const running =
    phase === 'thinking' || phase === 'scanning' || phase === 'scoring' || phase === 'drafting';
  const full = heldToday >= 10;

  const title =
    phase === 'done'
      ? full
        ? 'Today’s 10 are here'
        : 'Letters are in'
      : phase === 'error'
        ? 'That didn’t finish'
        : running
          ? 'Choosing the right roles'
          : full
            ? 'Today’s 10 are here'
            : '';

  const lead = running
    ? BEATS[phase]
    : phase === 'done' || phase === 'error'
      ? (resultMessage ??
        (phase === 'done'
          ? 'Read the letters below. A letter stays until you cancel it.'
          : 'Something got stuck. Try once more.'))
      : full
        ? 'A letter stays until you cancel it. Cancel one if you want a different role.'
        : heldToday > 0
          ? `You have ${heldToday} of today’s 10. A letter stays until you cancel it.`
          : 'Up to 10 roles today, with a letter for each. A letter stays until you cancel it.';

  const buttonLabel = running ? 'Working…' : full ? 'Today’s 10' : 'Refresh my drafts';

  const button = (
    <button
      type="button"
      className={inline ? 'wax desk-refresh-btn' : 'wax desk-btn desk-btn-fit desk-round-cta'}
      disabled={disabled || running || full}
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
  );

  if (inline) {
    return (
      <div className="desk-draft-refresh">
        <p aria-live="polite">{lead}</p>
        {button}
      </div>
    );
  }

  return (
    <section
      className={`desk-round desk-round-rail${phase === 'error' ? ' is-error' : ''}`}
      aria-label="Refresh my drafts"
    >
      <div className="desk-round-copy">
        <h2 className="desk-pane-title">{title || 'Today'}</h2>
        <p className="desk-round-lead" aria-live="polite">
          {lead}
        </p>
      </div>

      <div className="desk-round-action">
        {button}
        {disabled && disabledReason && phase === 'idle' ? (
          <p className="desk-round-hint">{disabledReason}</p>
        ) : null}
      </div>
    </section>
  );
}
