'use client';

import { useEffect, useState } from 'react';
import { ThinkingOrb, type OrbState } from 'thinking-orbs';

const BEATS: Array<{ state: OrbState; label: string }> = [
  { state: 'working', label: 'Working' },
  { state: 'searching', label: 'Searching' },
  { state: 'solving', label: 'Solving' },
  { state: 'listening', label: 'Listening' },
  { state: 'connecting', label: 'Connecting' },
  { state: 'composing', label: 'Composing' },
  { state: 'breathing', label: 'Breathing' },
  { state: 'weaving', label: 'Weaving' },
  { state: 'shaping', label: 'Shaping' },
];

export function ChoosingOrb() {
  const [index, setIndex] = useState(0);
  const beat = BEATS[index] ?? BEATS[0]!;

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % BEATS.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="desk-choosing" aria-live="polite" aria-busy="true">
      <div className="desk-choosing-orb">
        <ThinkingOrb state={beat.state} size={64} theme="light" aria-label={beat.label} />
      </div>
      <p>{beat.label}</p>
    </div>
  );
}
