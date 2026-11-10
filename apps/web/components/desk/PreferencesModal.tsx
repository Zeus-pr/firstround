'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  fetchPreferences,
  savePreferences,
  splitList,
  type PreferencesPayload,
} from '@/lib/preferences';

type Props = {
  open: boolean;
  user: User;
  onClose: () => void;
  onSaved: (onboardingStep: string) => void;
};

const EMPTY: PreferencesPayload = {
  jobFamilies: [],
  locations: [],
  targetLevel: '',
  links: {},
};

export function PreferencesModal({ open, user, onClose, onSaved }: Props) {
  const titleId = useId();
  const [families, setFamilies] = useState('');
  const [locations, setLocations] = useState('');
  const [targetLevel, setTargetLevel] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [github, setGithub] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setNote('');
    setLoaded(false);
    void fetchPreferences(user)
      .then((payload) => {
        if (cancelled) return;
        const prefs = payload.preferences ?? EMPTY;
        setFamilies(prefs.jobFamilies.join(', '));
        setLocations(prefs.locations.join(', '));
        setTargetLevel(prefs.targetLevel ?? '');
        setLinkedin(prefs.links.linkedin ?? '');
        setGithub(prefs.links.github ?? '');
        setPortfolio(prefs.links.portfolio ?? '');
        setLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setNote(error instanceof Error ? error.message : 'Could not load preferences.');
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNote('');
    try {
      const result = await savePreferences(user, {
        jobFamilies: splitList(families),
        locations: splitList(locations),
        targetLevel: targetLevel.trim() || null,
        links: {
          linkedin: linkedin.trim(),
          github: github.trim(),
          portfolio: portfolio.trim(),
        },
      });
      onSaved(result.onboardingStep);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="desk-modal-root" role="presentation">
      <button
        className="desk-modal-scrim"
        type="button"
        aria-label="Close preferences"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        className="desk-modal desk-modal-prefs"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="desk-modal-top">
          <p className="desk-kicker" id={titleId}>
            Preferences
          </p>
          <button className="text-button" type="button" disabled={busy} onClick={onClose}>
            Close
          </button>
        </header>

        <h2 className="desk-modal-heading">What jobs are you targeting?</h2>
        <p className="desk-lead">
          Job families, locations, and level. Saved before you connect Gmail.
        </p>

        <form className="desk-prefs-form" onSubmit={(event) => void onSubmit(event)}>
          <label className="desk-field">
            <span>Job families</span>
            <input
              value={families}
              onChange={(event) => setFamilies(event.target.value)}
              placeholder="Product, Design, Growth"
              disabled={!loaded || busy}
              autoComplete="off"
            />
          </label>
          <label className="desk-field">
            <span>Locations</span>
            <input
              value={locations}
              onChange={(event) => setLocations(event.target.value)}
              placeholder="Remote, Bengaluru, London"
              disabled={!loaded || busy}
              autoComplete="off"
            />
          </label>
          <label className="desk-field">
            <span>Target level</span>
            <input
              value={targetLevel}
              onChange={(event) => setTargetLevel(event.target.value)}
              placeholder="Mid, Senior, Staff"
              disabled={!loaded || busy}
              autoComplete="off"
            />
          </label>
          <label className="desk-field">
            <span>LinkedIn</span>
            <input
              value={linkedin}
              onChange={(event) => setLinkedin(event.target.value)}
              placeholder="https://"
              disabled={!loaded || busy}
              inputMode="url"
              autoComplete="url"
            />
          </label>
          <label className="desk-field">
            <span>GitHub</span>
            <input
              value={github}
              onChange={(event) => setGithub(event.target.value)}
              placeholder="https://"
              disabled={!loaded || busy}
              inputMode="url"
              autoComplete="url"
            />
          </label>
          <label className="desk-field">
            <span>Portfolio</span>
            <input
              value={portfolio}
              onChange={(event) => setPortfolio(event.target.value)}
              placeholder="https://"
              disabled={!loaded || busy}
              inputMode="url"
              autoComplete="url"
            />
          </label>

          <p className="note" role="status">
            {note}
          </p>

          <div className="desk-reveal-actions">
            <button className="wax" type="submit" disabled={!loaded || busy}>
              {busy ? 'Saving…' : 'Save preferences'}
            </button>
            <button className="text-button" type="button" disabled={busy} onClick={onClose}>
              Later
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
