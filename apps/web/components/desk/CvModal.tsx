'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReadinessResult } from '@/lib/cv';
import { AnalysisOrbs } from './AnalysisOrbs';
import { ReadinessReveal } from './ReadinessReveal';
import { ScoreName } from './ScoreName';

export type CvModalStage = 'upload' | 'analyzing' | 'suggesting' | 'result';

type Props = {
  open: boolean;
  stage: CvModalStage;
  fileName?: string;
  note: string;
  readiness: ReadinessResult | null;
  creditBalance?: number | null;
  suggestions?: string[];
  replacing?: boolean;
  primaryBusy?: boolean;
  onClose: () => void;
  onPickFile: (file: File | undefined) => void;
  onPrimary: () => void;
  onSkip?: () => void;
};

export function CvModal({
  open,
  stage,
  fileName,
  note,
  readiness,
  creditBalance,
  suggestions,
  replacing,
  primaryBusy,
  onClose,
  onPickFile,
  onPrimary,
  onSkip,
}: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = stage === 'analyzing' || stage === 'suggesting';

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  if (!open) return null;

  return (
    <div className="desk-modal-root" role="presentation">
      <button
        className="desk-modal-scrim"
        type="button"
        aria-label="Close"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div className="desk-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="desk-modal-top">
          <p className="desk-kicker" id={titleId}>
            {busy ? stage === 'suggesting' ? 'Suggestions' : 'Reading your CV' : <ScoreName />}
          </p>
          {!busy ? (
            <button className="text-button" type="button" onClick={onClose}>
              Close
            </button>
          ) : null}
        </header>

        {stage === 'analyzing' || stage === 'suggesting' ? (
          <AnalysisOrbs fileName={fileName} mode={stage === 'suggesting' ? 'suggest' : 'analyze'} />
        ) : null}

        {stage === 'upload' ? (
          <div className="desk-upload">
            <h2 className="desk-modal-heading">
              {replacing ? 'Replace your CV' : 'Upload your CV'}
            </h2>
            <p className="desk-lead">
              {replacing
                ? 'PDF or Word. We score the new file and replace the current score.'
                : 'PDF or Word. We extract facts and score the CV. Ordinary CVs get coaching, not a fail.'}
            </p>
            <input
              ref={inputRef}
              className="desk-file"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                onPickFile(file);
              }}
            />
            <button
              className="wax"
              type="button"
              disabled={primaryBusy}
              onClick={() => inputRef.current?.click()}
            >
              Choose CV
            </button>
            <p className="note" role="status">
              {note}
            </p>
          </div>
        ) : null}

        {stage === 'result' && readiness ? (
          <>
            <ReadinessReveal
              readiness={readiness}
              onPrimary={onPrimary}
              onSkip={onSkip}
              primaryBusy={primaryBusy}
              creditBalance={creditBalance}
              suggestions={suggestions}
            />
            {note ? (
              <p className="note" role="status">
                {note}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
