'use client';

import { Orb } from '@yogesharc/thinking-orbs';
import { ScoreName } from './ScoreName';

const ANALYZE_BEATS = [
  { state: 'searching' as const, line: 'Reading the CV' },
  { state: 'reasoning' as const, line: 'Extracting work history and skills' },
  { state: 'working' as const, line: 'Scoring the CV' },
];

const SUGGEST_BEATS = [
  { state: 'searching' as const, line: 'Reading the score gaps' },
  { state: 'working' as const, line: 'Writing concrete edit suggestions' },
  { state: 'reasoning' as const, line: 'Keeping the score unchanged' },
];

export function AnalysisOrbs({
  fileName,
  mode = 'analyze',
}: {
  fileName?: string;
  mode?: 'analyze' | 'suggest';
}) {
  const beats = mode === 'suggest' ? SUGGEST_BEATS : ANALYZE_BEATS;
  return (
    <div className="desk-analyze" aria-live="polite" aria-busy="true">
      <p className="desk-kicker">
        {mode === 'suggest' ? 'Writing suggestions' : 'Reading your CV'}
      </p>
      <h1>
        <ScoreName />
      </h1>
      <p className="desk-lead">
        {mode === 'suggest'
          ? 'Short edits based on the score and the text already on your CV. The score does not change.'
          : fileName
            ? `Working through ${fileName}. AI extracts facts. Our algorithm sets the score.`
            : 'Working through your CV. AI extracts facts. Our algorithm sets the score.'}
      </p>
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
