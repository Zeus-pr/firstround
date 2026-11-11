'use client';

import { useEffect, useId, useRef, useState } from 'react';

type Props = {
  busy?: boolean;
  onLink: (url: string) => void;
  onScreenshot: (file: File) => void;
};

export function AddOpening({ busy = false, onLink, onScreenshot }: Props) {
  const inputId = useId();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'link' | null>(null);
  const [url, setUrl] = useState('');
  const wasBusy = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (wasBusy.current && !busy) {
      setOpen(false);
      setMode(null);
      setUrl('');
    }
    wasBusy.current = busy;
  }, [busy]);

  return (
    <>
      <button type="button" className="desk-add-row" onClick={() => setOpen(true)}>
        <span>Add a job of your choice</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 12h14M13 6l6 6-6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div className="desk-modal-root" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button
            type="button"
            className="desk-modal-scrim"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="desk-modal">
            <div className="desk-modal-top">
              <h2 className="desk-modal-heading" id={titleId}>
                Add a role
              </h2>
              <button
                type="button"
                className="desk-btn desk-btn-fit"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="desk-pane-copy">
              Paste a link or a screenshot of a posting. We read it, find the address, and add a
              letter here.
            </p>
            <div className="desk-add-actions">
              <label className={`desk-btn${busy ? ' is-disabled' : ''}`}>
                Screenshot
                <input
                  className="desk-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) onScreenshot(file);
                  }}
                />
              </label>
              <button
                className="desk-btn"
                type="button"
                disabled={busy}
                aria-expanded={mode === 'link'}
                onClick={() => setMode(mode === 'link' ? null : 'link')}
              >
                Link
              </button>
            </div>
            {mode === 'link' ? (
              <form
                className="desk-add-link"
                onSubmit={(event) => {
                  event.preventDefault();
                  const next = url.trim();
                  if (!next || busy) return;
                  onLink(next);
                }}
              >
                <label className="desk-field" htmlFor={inputId}>
                  <span>Job link</span>
                  <input
                    id={inputId}
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    value={url}
                    disabled={busy}
                    onChange={(event) => setUrl(event.target.value)}
                  />
                </label>
                <button className="wax desk-btn" type="submit" disabled={busy || !url.trim()}>
                  {busy ? 'Reading…' : 'Add this role'}
                </button>
              </form>
            ) : null}
            {busy ? <p className="desk-pane-copy">Reading the posting…</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
