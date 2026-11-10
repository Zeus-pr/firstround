'use client';

import { useEffect, useState } from 'react';
import { Orb } from '@yogesharc/thinking-orbs';

export type RoundPhase =
  'idle' | 'thinking' | 'scanning' | 'scoring' | 'drafting' | 'done' | 'error';

const BEATS: Array<{
  phase: RoundPhase;
  line: string;
  state: 'searching' | 'reasoning' | 'working';
}> = [
  { phase: 'thinking', line: 'Reading your CV and preferences', state: 'searching' },
  { phase: 'scanning', line: 'Scanning today’s openings', state: 'working' },
  { phase: 'scoring', line: 'Scoring the strongest fits', state: 'reasoning' },
  { phase: 'drafting', line: 'Preparing letters for review', state: 'working' },
];

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
  const running = phase !== 'idle' && phase !== 'done' && phase !== 'error';
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1600);
    return () => window.clearInterval(id);
  }, [running]);

  const activeBeat =
    BEATS.find((b) => b.phase === phase) ?? BEATS[Math.min(tick % BEATS.length, BEATS.length - 1)]!;

  return (
    <section
      className={`desk-round ${running ? 'is-running' : ''} ${phase === 'done' ? 'is-done' : ''} ${phase === 'error' ? 'is-error' : ''}`}
      aria-label="Start my round"
    >
      <div className="desk-round-copy">
        <p className="desk-kicker">Your round</p>
        {running ? (
          <>
            <h2 className="desk-round-title">Working on it</h2>
            <p className="desk-round-lead" aria-live="polite">
              {activeBeat.line}
            </p>
          </>
        ) : phase === 'done' ? (
          <>
            <h2 className="desk-round-title">Round ready</h2>
            <p className="desk-round-lead">{resultMessage ?? 'Drafts are ready to review.'}</p>
          </>
        ) : phase === 'error' ? (
          <>
            <h2 className="desk-round-title">Couldn’t finish</h2>
            <p className="desk-round-lead">{resultMessage ?? 'Try again in a moment.'}</p>
          </>
        ) : (
          <>
            <h2 className="desk-round-title">Start my round</h2>
            <p className="desk-round-lead">
              We match your CV to today’s openings and draft letters for you to approve. Scraping
              stays under the hood.
            </p>
          </>
        )}
      </div>

      <div className="desk-round-action">
        {running ? (
          <div className="desk-round-process" role="status" aria-busy="true">
            <span className="desk-round-orb">
              <Orb state={activeBeat.state} size={56} label={activeBeat.line} />
            </span>
            <span className="desk-round-process-label">{activeBeat.line}</span>
            <span className="desk-round-glow" aria-hidden="true" />
          </div>
        ) : (
          <button
            type="button"
            className="wax desk-round-cta"
            disabled={disabled || running}
            onClick={onStart}
          >
            {phase === 'done' ? 'Run again' : phase === 'error' ? 'Try again' : 'Start my round'}
          </button>
        )}
        {disabled && disabledReason && phase === 'idle' ? (
          <p className="desk-round-hint">{disabledReason}</p>
        ) : null}
      </div>
    </section>
  );
}
