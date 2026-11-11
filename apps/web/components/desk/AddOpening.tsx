'use client';

import { useId, useState } from 'react';

type Props = {
  busy?: boolean;
  onLink: (url: string) => void;
  onScreenshot: (file: File) => void;
};

export function AddOpening({ busy = false, onLink, onScreenshot }: Props) {
  const inputId = useId();
  const [mode, setMode] = useState<'link' | null>(null);
  const [url, setUrl] = useState('');

  return (
    <section className="desk-pane" aria-label="Add a role">
      <h2 className="desk-pane-title">Add a role</h2>
      <p className="desk-pane-copy">
        Paste a link or a screenshot of a posting. We read it, find the address, and add a letter
        here.
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
      {busy && mode !== 'link' ? <p className="desk-pane-copy">Reading the posting…</p> : null}
    </section>
  );
}
