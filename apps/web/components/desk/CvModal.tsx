'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReadinessResult } from '@/lib/cv';
import { AnalysisOrbs } from './AnalysisOrbs';
import { ReadinessReveal } from './ReadinessReveal';

export type CvModalStage = 'upload' | 'analyzing' | 'result';

type Props = {
  open: boolean;
  stage: CvModalStage;
  fileName?: string;
  note: string;
  readiness: ReadinessResult | null;
  onClose: () => void;
  onPickFile: (file: File | undefined) => void;
  onPrimary: () => void;
  primaryBusy?: boolean;
};

export function CvModal({
  open,
  stage,
  fileName,
  note,
  readiness,
  onClose,
  onPickFile,
  onPrimary,
  primaryBusy,
}: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stage !== 'analyzing') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, stage]);

  if (!open) return null;

  return (
    <div className="desk-modal-root" role="presentation">
      <button className="desk-modal-scrim" type="button" aria-label="Close" onClick={onClose} />
      <div className="desk-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="desk-modal-top">
          <p className="desk-kicker" id={titleId}>
            LetterProof
          </p>
          {stage !== 'analyzing' ? (
            <button className="text-button" type="button" onClick={onClose}>
              Close
            </button>
          ) : null}
        </header>

        {stage === 'analyzing' ? <AnalysisOrbs fileName={fileName} /> : null}

        {stage === 'upload' ? (
          <div className="desk-upload">
            <h2 className="desk-modal-heading">Place your CV on the desk</h2>
            <p className="desk-lead">
              PDF or Word. We read hard layouts, normalize skills, and score LetterProof. Ordinary
              CVs are coached, not failed.
            </p>
            <input
              ref={inputRef}
              className="desk-file"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => onPickFile(event.target.files?.[0])}
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
          <ReadinessReveal readiness={readiness} onPrimary={onPrimary} />
        ) : null}
      </div>
    </div>
  );
}
