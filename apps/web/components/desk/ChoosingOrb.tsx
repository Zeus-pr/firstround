'use client';

import { useEffect, useState } from 'react';
import { Orb, type OrbState } from '@yogesharc/thinking-orbs';

const BEATS: Array<{ state: OrbState; label: string }> = [
  { state: 'searching', label: 'Solving' },
  { state: 'reasoning', label: 'Thinking' },
  { state: 'working', label: 'Working' },
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
      <Orb state={beat.state} size={168} label={beat.label} />
      <p>{beat.label}</p>
    </div>
  );
}
