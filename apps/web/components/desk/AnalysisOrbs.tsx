'use client';

import { Orb } from '@yogesharc/thinking-orbs';

const BEATS = [
  { state: 'searching' as const, line: 'Reading the sheet' },
  { state: 'reasoning' as const, line: 'Sorting proof from noise' },
  { state: 'working' as const, line: 'Scoring LetterProof' },
];

export function AnalysisOrbs({ fileName }: { fileName?: string }) {
  return (
    <div className="desk-analyze" aria-live="polite" aria-busy="true">
      <p className="desk-kicker">First Round is reading</p>
      <h1>LetterProof</h1>
      <p className="desk-lead">
        {fileName ? `Working through ${fileName}.` : 'Working through your CV.'} The model extracts
        facts. Our algorithm owns the score.
      </p>
      <ul className="desk-orbs">
        {BEATS.map((beat) => (
          <li key={beat.state}>
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
