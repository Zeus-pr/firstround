'use client';

import { Orb } from '@yogesharc/thinking-orbs';

const ANALYZE_BEATS = [
  { state: 'searching' as const, line: 'Reading the sheet' },
  { state: 'reasoning' as const, line: 'Sorting proof from noise' },
  { state: 'working' as const, line: 'Scoring LetterProof' },
];

const SUPERCHARGE_BEATS = [
  { state: 'reasoning' as const, line: 'Grounding every claim' },
  { state: 'working' as const, line: 'Rewriting for clarity' },
  { state: 'searching' as const, line: 'Re-scoring LetterProof' },
];

export function AnalysisOrbs({
  fileName,
  mode = 'analyze',
}: {
  fileName?: string;
  mode?: 'analyze' | 'supercharge';
}) {
  const beats = mode === 'supercharge' ? SUPERCHARGE_BEATS : ANALYZE_BEATS;
  return (
    <div className="desk-analyze" aria-live="polite" aria-busy="true">
      <p className="desk-kicker">
        {mode === 'supercharge' ? 'First Round is Supercharging' : 'First Round is reading'}
      </p>
      <h1>LetterProof</h1>
      <p className="desk-lead">
        {mode === 'supercharge'
          ? 'Improving wording from facts already on the page. No invented employers or metrics.'
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
