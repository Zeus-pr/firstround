'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { ReadinessResult } from '@/lib/cv';

const DIMENSIONS: { key: keyof ReadinessResult['dimensions']; label: string }[] = [
  { key: 'evidenceCompleteness', label: 'Evidence' },
  { key: 'outcomeQuality', label: 'Outcomes' },
  { key: 'targetRoleCoverage', label: 'Role fit' },
  { key: 'careerConsistency', label: 'Consistency' },
  { key: 'communicationClarity', label: 'Clarity' },
];

export function ReadinessReveal({
  readiness,
  onPrimary,
}: {
  readiness: ReadinessResult;
  onPrimary: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { recommendation, band, total } = readiness;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const scoreEl = root.querySelector<HTMLElement>('.desk-score-num');
    const bars = root.querySelectorAll<HTMLElement>('.desk-bar-fill');
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(
      root.querySelectorAll('.desk-reveal-in'),
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, stagger: 0.08 },
    );
    if (scoreEl) {
      const proxy = { n: 0 };
      tl.to(
        proxy,
        {
          n: total,
          duration: 1.1,
          ease: 'power2.out',
          onUpdate: () => {
            scoreEl.textContent = String(Math.round(proxy.n));
          },
        },
        0.15,
      );
    }
    bars.forEach((bar, index) => {
      const target = Number(bar.dataset.value ?? 0);
      tl.fromTo(
        bar,
        { scaleX: 0 },
        { scaleX: target / 100, duration: 0.7, ease: 'power2.out' },
        0.25 + index * 0.05,
      );
    });
    return () => {
      tl.kill();
    };
  }, [total]);

  const primaryLabel =
    band === 'ready' ? 'Continue' : band === 'supercharge' ? 'Supercharge CV' : 'Strengthen CV';

  return (
    <div className="desk-reveal" ref={rootRef}>
      <p className={`desk-band desk-reveal-in band-${band}`}>{recommendation.headline}</p>
      <div className="desk-score desk-reveal-in" aria-label={`LetterProof score ${total}`}>
        <span className="desk-score-num">{total}</span>
        <span className="desk-score-of">/100</span>
      </div>
      <p className="desk-lead desk-reveal-in">{recommendation.body}</p>

      <ul className="desk-dims desk-reveal-in" aria-label="Dimension scores">
        {DIMENSIONS.map((dim) => {
          const value = readiness.dimensions[dim.key];
          return (
            <li key={dim.key}>
              <div className="desk-dim-top">
                <span>{dim.label}</span>
                <span>{value}</span>
              </div>
              <div className="desk-bar" aria-hidden="true">
                <span className="desk-bar-fill" data-value={value} />
              </div>
            </li>
          );
        })}
      </ul>

      {readiness.genuineGaps.length > 0 ? (
        <section className="desk-gaps desk-reveal-in">
          <h2>Fix these</h2>
          <ul>
            {readiness.genuineGaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {readiness.underEmphasised.length > 0 ? (
        <section className="desk-gaps soft desk-reveal-in">
          <h2>Under-emphasised</h2>
          <ul>
            {readiness.underEmphasised.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="desk-meta desk-reveal-in">
        {readiness.parse.visionUsed ? 'Hard PDF path used (vision). ' : null}
        First Round LetterProof · {readiness.algorithmVersion}. Not a universal ATS score.
      </p>

      <button className="wax desk-reveal-in" type="button" onClick={onPrimary}>
        {primaryLabel}
      </button>
    </div>
  );
}
