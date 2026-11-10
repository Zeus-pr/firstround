'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  EMPTY_CRITERIA,
  fetchPreferences,
  parseOptionalNumber,
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
  criteria: EMPTY_CRITERIA,
};

const WORK_MODES: Array<'remote' | 'hybrid' | 'onsite'> = ['remote', 'hybrid', 'onsite'];

export function PreferencesModal({ open, user, onClose, onSaved }: Props) {
  const titleId = useId();
  const [families, setFamilies] = useState('');
  const [locations, setLocations] = useState('');
  const [targetLevel, setTargetLevel] = useState('');
  const [ctcMin, setCtcMin] = useState('');
  const [ctcMax, setCtcMax] = useState('');
  const [desiredCompanies, setDesiredCompanies] = useState('');
  const [avoidCompanies, setAvoidCompanies] = useState('');
  const [industries, setIndustries] = useState('');
  const [skills, setSkills] = useState('');
  const [keywords, setKeywords] = useState('');
  const [employmentTypes, setEmploymentTypes] = useState('');
  const [workModes, setWorkModes] = useState<Array<'remote' | 'hybrid' | 'onsite'>>([]);
  const [noticePeriodDays, setNoticePeriodDays] = useState('');
  const [minYears, setMinYears] = useState('');
  const [maxYears, setMaxYears] = useState('');
  const [openToRelocation, setOpenToRelocation] = useState(false);
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
        const c = prefs.criteria ?? EMPTY_CRITERIA;
        setFamilies(prefs.jobFamilies.join(', '));
        setLocations(prefs.locations.join(', '));
        setTargetLevel(prefs.targetLevel ?? '');
        setCtcMin(c.expectedCtcMinLakh != null ? String(c.expectedCtcMinLakh) : '');
        setCtcMax(c.expectedCtcMaxLakh != null ? String(c.expectedCtcMaxLakh) : '');
        setDesiredCompanies(c.desiredCompanies.join(', '));
        setAvoidCompanies(c.avoidCompanies.join(', '));
        setIndustries(c.industries.join(', '));
        setSkills(c.skills.join(', '));
        setKeywords(c.keywords.join(', '));
        setEmploymentTypes(c.employmentTypes.join(', '));
        setWorkModes(c.workModes ?? []);
        setNoticePeriodDays(c.noticePeriodDays != null ? String(c.noticePeriodDays) : '');
        setMinYears(c.minYearsExperience != null ? String(c.minYearsExperience) : '');
        setMaxYears(c.maxYearsExperience != null ? String(c.maxYearsExperience) : '');
        setOpenToRelocation(c.openToRelocation === true);
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

  function toggleMode(mode: 'remote' | 'hybrid' | 'onsite') {
    setWorkModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode],
    );
  }

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
        criteria: {
          expectedCtcMinLakh: parseOptionalNumber(ctcMin),
          expectedCtcMaxLakh: parseOptionalNumber(ctcMax),
          desiredCompanies: splitList(desiredCompanies, 30),
          avoidCompanies: splitList(avoidCompanies, 30),
          industries: splitList(industries),
          skills: splitList(skills, 40),
          workModes,
          employmentTypes: splitList(employmentTypes, 10),
          keywords: splitList(keywords, 30),
          noticePeriodDays: parseOptionalNumber(noticePeriodDays),
          openToRelocation,
          minYearsExperience: parseOptionalNumber(minYears),
          maxYearsExperience: parseOptionalNumber(maxYears),
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

        <h2 className="desk-modal-heading">What are you looking for?</h2>
        <p className="desk-lead">
          Optional details help us rank openings. Leave anything blank — we still find fits.
        </p>

        <form className="desk-prefs-form" onSubmit={(event) => void onSubmit(event)}>
          <p className="desk-prefs-section">Role</p>
          <label className="desk-field">
            <span>Job families</span>
            <input
              value={families}
              onChange={(event) => setFamilies(event.target.value)}
              placeholder="Product, Backend, Revenue"
              disabled={!loaded || busy}
              autoComplete="off"
            />
          </label>
          <label className="desk-field">
            <span>Locations</span>
            <input
              value={locations}
              onChange={(event) => setLocations(event.target.value)}
              placeholder="Bengaluru, Mumbai, Remote"
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
            <span>Keywords</span>
            <input
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
              placeholder="P&amp;L, GTM, NestJS"
              disabled={!loaded || busy}
              autoComplete="off"
            />
          </label>
          <label className="desk-field">
            <span>Skills you want in the role</span>
            <input
              value={skills}
              onChange={(event) => setSkills(event.target.value)}
              placeholder="SQL, React, category management"
              disabled={!loaded || busy}
              autoComplete="off"
            />
          </label>

          <p className="desk-prefs-section">Pay &amp; companies</p>
          <div className="desk-prefs-row">
            <label className="desk-field">
              <span>Expected CTC min (LPA)</span>
              <input
                value={ctcMin}
                onChange={(event) => setCtcMin(event.target.value)}
                placeholder="18"
                inputMode="decimal"
                disabled={!loaded || busy}
              />
            </label>
            <label className="desk-field">
              <span>Expected CTC max (LPA)</span>
              <input
                value={ctcMax}
                onChange={(event) => setCtcMax(event.target.value)}
                placeholder="35"
                inputMode="decimal"
                disabled={!loaded || busy}
              />
            </label>
          </div>
          <label className="desk-field">
            <span>Companies you’d like</span>
            <input
              value={desiredCompanies}
              onChange={(event) => setDesiredCompanies(event.target.value)}
              placeholder="Razorpay, Swiggy, Atlassian"
              disabled={!loaded || busy}
              autoComplete="off"
            />
          </label>
          <label className="desk-field">
            <span>Companies to deprioritize</span>
            <input
              value={avoidCompanies}
              onChange={(event) => setAvoidCompanies(event.target.value)}
              placeholder="Optional"
              disabled={!loaded || busy}
              autoComplete="off"
            />
          </label>
          <label className="desk-field">
            <span>Industries</span>
            <input
              value={industries}
              onChange={(event) => setIndustries(event.target.value)}
              placeholder="Fintech, Consumer, SaaS"
              disabled={!loaded || busy}
              autoComplete="off"
            />
          </label>

          <p className="desk-prefs-section">Work setup</p>
          <fieldset className="desk-prefs-modes" disabled={!loaded || busy}>
            <legend>Work mode</legend>
            <div className="desk-prefs-mode-list">
              {WORK_MODES.map((mode) => (
                <label key={mode} className="desk-prefs-check">
                  <input
                    type="checkbox"
                    checked={workModes.includes(mode)}
                    onChange={() => toggleMode(mode)}
                  />
                  <span>{mode}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="desk-field">
            <span>Employment type</span>
            <input
              value={employmentTypes}
              onChange={(event) => setEmploymentTypes(event.target.value)}
              placeholder="Full-time, Contract"
              disabled={!loaded || busy}
              autoComplete="off"
            />
          </label>
          <div className="desk-prefs-row">
            <label className="desk-field">
              <span>Notice period (days)</span>
              <input
                value={noticePeriodDays}
                onChange={(event) => setNoticePeriodDays(event.target.value)}
                placeholder="30"
                inputMode="numeric"
                disabled={!loaded || busy}
              />
            </label>
            <label className="desk-field">
              <span>Experience min (years)</span>
              <input
                value={minYears}
                onChange={(event) => setMinYears(event.target.value)}
                placeholder="3"
                inputMode="numeric"
                disabled={!loaded || busy}
              />
            </label>
            <label className="desk-field">
              <span>Experience max (years)</span>
              <input
                value={maxYears}
                onChange={(event) => setMaxYears(event.target.value)}
                placeholder="8"
                inputMode="numeric"
                disabled={!loaded || busy}
              />
            </label>
          </div>
          <label className="desk-prefs-check desk-prefs-check-block">
            <input
              type="checkbox"
              checked={openToRelocation}
              onChange={(event) => setOpenToRelocation(event.target.checked)}
              disabled={!loaded || busy}
            />
            <span>Open to relocating for the right role</span>
          </label>

          <p className="desk-prefs-section">Links</p>
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
