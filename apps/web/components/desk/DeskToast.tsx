'use client';

import { useEffect, useState } from 'react';

type Tone = 'good' | 'empty' | 'bad' | 'info';

function toneOf(message: string): Tone {
  const text = message.toLowerCase();
  if (/could not|stuck|fail|error|already gone/.test(text)) return 'bad';
  if (/no new|nothing|no opening|no role|no letters/.test(text)) return 'empty';
  if (/found|added|saved|deleted|connected/.test(text)) return 'good';
  return 'info';
}

function ToastIcon({ tone }: { tone: Tone }) {
  if (tone === 'good') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.2 8.2 6.4 11.4 12.8 4.6" />
      </svg>
    );
  }
  if (tone === 'bad') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 3.2v6.2" />
        <path d="M8 12.2h.01" />
      </svg>
    );
  }
  if (tone === 'empty') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="4.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="2.1" />
    </svg>
  );
}

export function DeskToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const tone = toneOf(message);

  useEffect(() => {
    const hide = window.setTimeout(() => setLeaving(true), 5200);
    return () => window.clearTimeout(hide);
  }, [message]);

  useEffect(() => {
    if (!leaving) return;
    const gone = window.setTimeout(onDone, 280);
    return () => window.clearTimeout(gone);
  }, [leaving, onDone]);

  return (
    <div className="desk-toast-stack">
      <div className={`desk-toast tone-${tone}${leaving ? ' is-leaving' : ''}`} role="status">
        <span className="desk-toast-icon">
          <ToastIcon tone={tone} />
        </span>
        <p>{message}</p>
        <button type="button" aria-label="Close" onClick={() => setLeaving(true)}>
          ×
        </button>
      </div>
    </div>
  );
}
