import { describe, expect, it } from 'vitest';
import { pickTemplate, renderLetter } from '../src/jobs/letter-templates.js';

const base = {
  company: 'Myntra',
  role: 'Category Manager',
  sourceUrl: 'https://www.naukri.com/job/1',
  candidateName: 'Shubhayan Mitra',
  phone: '+91 6291061341',
  linkedin: 'https://www.linkedin.com/in/example',
  bullets: ['Owned a Rs. 250 Cr portfolio, with 22% YoY growth.'],
  seed: 'job-1',
};

describe('letter templates', () => {
  it('stays on the join letter when shuffle is off', () => {
    const letter = renderLetter({ ...base, shuffle: false });
    expect(letter.templateId).toBe('join');
    expect(letter.subject).toBe('I would love to join Myntra');
    const named = renderLetter({ ...base, shuffle: false, recruiterName: 'Ishika' });
    expect(named.subject).toBe('Ishika, I would love to join Myntra');
    expect(letter.body.split('\n')).toContain('https://www.naukri.com/job/1');
    expect(letter.body).toContain('A bit about me:');
    expect(letter.body).not.toMatch(/i've been working with/i);
  });

  it('changes subject and opening across seeds when shuffle is on', () => {
    const ids = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((seed) => pickTemplate(true, seed)),
    );
    expect(ids.size).toBeGreaterThan(1);
    const worked = renderLetter({ ...base, shuffle: true, seed: 'work' });
    expect(worked.subject.length).toBeGreaterThan(8);
    expect(worked.body).toContain('Owned a Rs. 250 Cr portfolio');
  });
});
