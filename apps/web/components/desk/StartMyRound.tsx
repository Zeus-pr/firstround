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
  inline?: boolean;
};

export function StartMyRound({
  disabled = false,
  disabledReason,
  phase,
  resultMessage,
  onStart,
  inline = false,
}: Props) {
  const running =
    phase === 'thinking' || phase === 'scanning' || phase === 'scoring' || phase === 'drafting';

  const title =
    phase === 'done'
      ? 'Letters are in'
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
          ? 'Read the letters below. A letter stays until you cancel it.'
          : 'Something got stuck. Try once more.'))
      : 'Each refresh adds up to 10 more. A letter stays until you cancel it.';

  const buttonLabel = running ? 'Working…' : 'Refresh my drafts';

  const button = (
    <button
      type="button"
      className={inline ? 'wax desk-refresh-btn' : 'wax desk-btn desk-btn-fit desk-round-cta'}
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
