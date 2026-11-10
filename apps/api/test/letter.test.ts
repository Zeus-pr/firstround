import { describe, expect, it } from 'vitest';
import { validateDraftBody } from '../src/jobs/draft.js';
import {
  composeLetter,
  letterIsGrounded,
  linkOnOwnLine,
  proofBullets,
} from '../src/jobs/letter.js';

const cv = {
  fullName: 'SHUBHAYAN MITRA',
  phones: ['+91 6291061341'],
  links: { linkedin: 'https://www.linkedin.com/in/example' },
  roles: [
    {
      title: 'Assistant Manager — Category & Revenue Management',
      company: 'Samsung Electronics',
      isCurrent: true,
      bullets: [
        'Owned P&L for a Rs. 250 Cr annualized TV & Audio portfolio, delivering 22% YoY revenue growth.',
        'Built SKU-level demand models with MAPE under 10% across 5 regional warehouses.',
      ],
    },
  ],
};

describe('composeLetter', () => {
  it('keeps the job link on its own line and only uses CV numbers', () => {
    const job = {
      company: 'Myntra',
      role: 'Principal Associate - Category Demand Management',
      sourceUrl: 'https://www.naukri.com/job/abc',
    };
    const letter = composeLetter(cv, job);
    expect(linkOnOwnLine(letter.body, job.sourceUrl)).toBe(true);
    expect(letter.body).not.toMatch(/\(link here\)/i);
    expect(letter.body).toContain('A bit about me:');
    expect(letter.body).toContain('Rs. 250 Cr');
    expect(letter.body).toContain('MAPE under 10%');
    expect(letter.body).toContain('Shubhayan Mitra');
    expect(letter.body).not.toMatch(/my background fits|i've been working with/i);
    expect(letterIsGrounded(letter.body, letter.source)).toBe(true);
    expect(letterIsGrounded(`${letter.body}\nI grew revenue 99%.`, letter.source)).toBe(false);

    const check = validateDraftBody(letter.body, {
      company: job.company,
      role: job.role,
      person: '',
      evidenceFacts: letter.evidenceFacts,
      priorCompanies: letter.priorCompanies,
    });
    expect(check.ok).toBe(true);
  });

  it('keeps a mixed-case name and still writes when the current role has no bullets', () => {
    const letter = composeLetter(
      {
        fullName: 'Ada Lovelace',
        roles: [
          { title: 'Research Intern', company: 'Analytical Engines', isCurrent: true, bullets: [] },
          {
            title: 'Backend Engineer',
            company: 'Acme',
            bullets: ['Cut API latency by 40% on the checkout path.'],
          },
        ],
      },
      { company: 'Razorpay', role: 'Backend Engineer', sourceUrl: null },
    );
    expect(letter.body).toContain('Ada Lovelace');
    expect(letter.body).toContain('40%');
    expect(letter.body).not.toContain('http');
    expect(linkOnOwnLine(letter.body, null)).toBe(true);
  });

  it('does not treat a year as the proof line when a metric bullet exists', () => {
    expect(proofBullets(['Joined in 2024.', 'Raised revenue 22% YoY.'])).toEqual([
      'Raised revenue 22% YoY.',
    ]);
  });
});
