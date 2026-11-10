'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  EMPTY_CRITERIA,
  fetchPreferences,
  parseOptionalNumber,
  savePreferences,
  type PreferencesPayload,
} from '@/lib/preferences';
import {
  addCatalogOption,
  FALLBACK_CATALOG,
  fetchCatalog,
  type CatalogLists,
} from '@/lib/preference-catalog';
import { SearchMulti } from './SearchMulti';

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

const MODES = ['remote', 'hybrid', 'onsite'] as const;

export function PreferencesModal({ open, user, onClose, onSaved }: Props) {
  const titleId = useId();
  const [catalog, setCatalog] = useState<CatalogLists>(FALLBACK_CATALOG);
  const [families, setFamilies] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [targetLevel, setTargetLevel] = useState<string[]>([]);
  const [ctcMin, setCtcMin] = useState('');
  const [ctcMax, setCtcMax] = useState('');
  const [desiredCompanies, setDesiredCompanies] = useState<string[]>([]);
  const [avoidCompanies, setAvoidCompanies] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([]);
  const [workModes, setWorkModes] = useState<Array<(typeof MODES)[number]>>([]);
  const [noticePeriodDays, setNoticePeriodDays] = useState('');
  const [minYears, setMinYears] = useState('');
  const [maxYears, setMaxYears] = useState('');
  const [openToRelocation, setOpenToRelocation] = useState(false);
  const [letterShuffle, setLetterShuffle] = useState(true);
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
    void Promise.all([fetchPreferences(user), fetchCatalog(user)])
      .then(([payload, lists]) => {
        if (cancelled) return;
        const prefs = payload.preferences ?? EMPTY;
        const c = prefs.criteria ?? EMPTY_CRITERIA;
        setCatalog(lists);
        setFamilies(prefs.jobFamilies);
        setLocations(prefs.locations);
        setTargetLevel(prefs.targetLevel ? [prefs.targetLevel] : []);
        setCtcMin(c.expectedCtcMinLakh != null ? String(c.expectedCtcMinLakh) : '');
        setCtcMax(c.expectedCtcMaxLakh != null ? String(c.expectedCtcMaxLakh) : '');
        setDesiredCompanies(c.desiredCompanies);
        setAvoidCompanies(c.avoidCompanies);
        setIndustries(c.industries);
        setSkills(c.skills);
        setKeywords(c.keywords);
        setEmploymentTypes(c.employmentTypes);
        setWorkModes(c.workModes ?? []);
        setNoticePeriodDays(c.noticePeriodDays != null ? String(c.noticePeriodDays) : '');
        setMinYears(c.minYearsExperience != null ? String(c.minYearsExperience) : '');
        setMaxYears(c.maxYearsExperience != null ? String(c.maxYearsExperience) : '');
        setOpenToRelocation(c.openToRelocation === true);
        setLetterShuffle(c.letterShuffle !== false);
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

  function add(kind: keyof CatalogLists) {
    return async (label: string) => {
      const lists = await addCatalogOption(user, kind, label);
      setCatalog(lists);
    };
  }

  function toggleMode(mode: (typeof MODES)[number]) {
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
        jobFamilies: families,
        locations,
        targetLevel: targetLevel[0] ?? null,
        links: { linkedin: linkedin.trim(), github: github.trim(), portfolio: portfolio.trim() },
        criteria: {
          expectedCtcMinLakh: parseOptionalNumber(ctcMin),
          expectedCtcMaxLakh: parseOptionalNumber(ctcMax),
          desiredCompanies,
          avoidCompanies,
          industries,
          skills,
          workModes,
          employmentTypes,
          keywords,
          noticePeriodDays: parseOptionalNumber(noticePeriodDays),
          openToRelocation,
          minYearsExperience: parseOptionalNumber(minYears),
          maxYearsExperience: parseOptionalNumber(maxYears),
          letterShuffle,
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
        onClick={() => !busy && onClose()}
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
          Optional. Leave a list empty and we still look. Search, pick, or add anything missing.
        </p>
        <form className="desk-prefs-form" onSubmit={(event) => void onSubmit(event)}>
          <SearchMulti
            label="Job families"
            options={catalog.family}
            value={families}
            onChange={setFamilies}
            onAdd={add('family')}
            disabled={!loaded || busy}
          />
          <SearchMulti
            label="Locations"
            placeholder="Search Indian cities"
            options={catalog.location}
            value={locations}
            onChange={setLocations}
            onAdd={add('location')}
            disabled={!loaded || busy}
          />
          <SearchMulti
            label="Target level"
            options={catalog.level}
            value={targetLevel}
            onChange={setTargetLevel}
            onAdd={add('level')}
            single
            disabled={!loaded || busy}
          />
          <SearchMulti
            label="Keywords"
            options={catalog.keyword}
            value={keywords}
            onChange={setKeywords}
            onAdd={add('keyword')}
            disabled={!loaded || busy}
          />
          <SearchMulti
            label="Skills you want in the role"
            options={catalog.skill}
            value={skills}
            onChange={setSkills}
            onAdd={add('skill')}
            disabled={!loaded || busy}
          />
          <SearchMulti
            label="Companies you’d like"
            options={catalog.company}
            value={desiredCompanies}
            onChange={setDesiredCompanies}
            onAdd={add('company')}
            disabled={!loaded || busy}
          />
          <SearchMulti
            label="Companies to deprioritize"
            options={catalog.company}
            value={avoidCompanies}
            onChange={setAvoidCompanies}
            onAdd={add('company')}
            disabled={!loaded || busy}
          />
          <SearchMulti
            label="Industries"
            options={catalog.industry}
            value={industries}
            onChange={setIndustries}
            onAdd={add('industry')}
            disabled={!loaded || busy}
          />
          <SearchMulti
            label="Employment type"
            options={catalog.employment}
            value={employmentTypes}
            onChange={setEmploymentTypes}
            onAdd={add('employment')}
            disabled={!loaded || busy}
          />

          <div className="desk-pick">
            <span className="desk-pick-label">Work mode</span>
            <div className="desk-choice-row">
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`desk-choice${workModes.includes(mode) ? ' is-on' : ''}`}
                  aria-pressed={workModes.includes(mode)}
                  disabled={!loaded || busy}
                  onClick={() => toggleMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="desk-prefs-row">
            <label className="desk-field">
              <span>Expected CTC min (LPA)</span>
              <input
                value={ctcMin}
                onChange={(e) => setCtcMin(e.target.value)}
                inputMode="decimal"
                disabled={!loaded || busy}
              />
            </label>
            <label className="desk-field">
              <span>Expected CTC max (LPA)</span>
              <input
                value={ctcMax}
                onChange={(e) => setCtcMax(e.target.value)}
                inputMode="decimal"
                disabled={!loaded || busy}
              />
            </label>
          </div>
          <div className="desk-prefs-row">
            <label className="desk-field">
              <span>Notice period (days)</span>
              <input
                value={noticePeriodDays}
                onChange={(e) => setNoticePeriodDays(e.target.value)}
                inputMode="numeric"
                disabled={!loaded || busy}
              />
            </label>
            <label className="desk-field">
              <span>Experience min (years)</span>
              <input
                value={minYears}
                onChange={(e) => setMinYears(e.target.value)}
                inputMode="numeric"
                disabled={!loaded || busy}
              />
            </label>
            <label className="desk-field">
              <span>Experience max (years)</span>
              <input
                value={maxYears}
                onChange={(e) => setMaxYears(e.target.value)}
                inputMode="numeric"
                disabled={!loaded || busy}
              />
            </label>
          </div>
          <button
            type="button"
            className={`desk-choice${openToRelocation ? ' is-on' : ''}`}
            aria-pressed={openToRelocation}
            disabled={!loaded || busy}
            onClick={() => setOpenToRelocation((v) => !v)}
          >
            Open to relocating
          </button>
          <button
            type="button"
            className={`desk-choice${letterShuffle ? ' is-on' : ''}`}
            aria-pressed={letterShuffle}
            disabled={!loaded || busy}
            onClick={() => setLetterShuffle((v) => !v)}
          >
            {letterShuffle ? 'Smart shuffle on' : 'Smart shuffle off'}
          </button>

          <p className="desk-prefs-section">Links</p>
          <label className="desk-field">
            <span>LinkedIn</span>
            <input
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="https://"
              inputMode="url"
              disabled={!loaded || busy}
            />
          </label>
          <label className="desk-field">
            <span>GitHub</span>
            <input
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              placeholder="https://"
              inputMode="url"
              disabled={!loaded || busy}
            />
          </label>
          <label className="desk-field">
            <span>Portfolio</span>
            <input
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
              placeholder="https://"
              inputMode="url"
              disabled={!loaded || busy}
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
