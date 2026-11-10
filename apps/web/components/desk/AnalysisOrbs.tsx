'use client';

import { Orb } from '@yogesharc/thinking-orbs';

const ANALYZE_BEATS = [
  { state: 'searching' as const, line: 'Work history' },
  { state: 'reasoning' as const, line: 'Skills' },
  { state: 'working' as const, line: 'Score' },
];

const SUGGEST_BEATS = [
  { state: 'searching' as const, line: 'Gaps' },
  { state: 'working' as const, line: 'Edits' },
];

export function AnalysisOrbs({
  fileName,
  titleId,
  mode = 'analyze',
}: {
  fileName?: string;
  titleId?: string;
  mode?: 'analyze' | 'suggest';
}) {
  const beats = mode === 'suggest' ? SUGGEST_BEATS : ANALYZE_BEATS;
  return (
    <div className="desk-analyze" aria-live="polite" aria-busy="true">
      {mode === 'analyze' ? (
        <p className="desk-lead" id={titleId}>
          Reading your CV. This might take a while, since it is passing through the Firstround
          algorithm and AI.
        </p>
      ) : null}
      {fileName ? <p className="desk-lead">{fileName}</p> : null}
      <ul className="desk-orbs">
        {beats.map((beat) => (
          <li key={beat.line}>
            <span className="desk-orb">
              <Orb state={beat.state} size={52} label={beat.line} />
            </span>
            <span>{beat.line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
