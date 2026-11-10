'use client';

import { Orb } from '@yogesharc/thinking-orbs';

const ANALYZE_BEATS = [
  { state: 'searching' as const, line: 'Reading the sheet' },
  { state: 'reasoning' as const, line: 'Sorting proof from noise' },
  { state: 'working' as const, line: 'Scoring LetterProof' },
];

const SUGGEST_BEATS = [
  { state: 'searching' as const, line: 'Reading the gaps already scored' },
  { state: 'working' as const, line: 'Writing a few concrete edits' },
  { state: 'reasoning' as const, line: 'Leaving the score as it is' },
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
        {mode === 'suggest' ? 'First Round is writing suggestions' : 'First Round is reading'}
      </p>
      <h1>LetterProof</h1>
      <p className="desk-lead">
        {mode === 'suggest'
          ? 'Short edits from the score and the lines already on the CV. The number does not move.'
          : fileName
            ? `Working through ${fileName}. The model extracts facts. Our algorithm owns the score.`
            : 'Working through your CV. The model extracts facts. Our algorithm owns the score.'}
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
