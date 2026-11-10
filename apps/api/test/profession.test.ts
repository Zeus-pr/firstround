import { describe, expect, it } from 'vitest';
import { candidateProfession, professionOfText, sameProfession } from '../src/jobs/profession.js';
import { judgeJobFit, parseFitVerdict } from '../src/jobs/fit-review.js';

const mainframe = {
  roles: [{ title: 'Mainframe Developer', isCurrent: true }],
  targetRoleHints: ['COBOL', 'CICS'],
  skills: ['COBOL', 'DB2', 'JCL', 'Java'],
};

describe('profession gate', () => {
  it('keeps a mainframe CV off software and commercial titles', () => {
    expect(candidateProfession(mainframe)).toBe('mainframe');
    for (const title of [
      'Java Developer',
      'AWS Engineer',
      'Full Stack Developer',
      'Category Manager',
      'Revenue Manager',
      'Product Manager',
    ]) {
      expect(sameProfession('mainframe', title)).toBe(false);
    }
    expect(sameProfession('mainframe', 'COBOL Developer')).toBe(true);
    expect(sameProfession('mainframe', 'CICS Administrator')).toBe(true);
    expect(sameProfession('mainframe', 'DB2 Developer')).toBe(true);
  });

  it('reads the current title, not a stray skill', () => {
    expect(
      candidateProfession({
        roles: [{ title: 'Category Manager', isCurrent: true }],
        skills: ['Java', 'AWS'],
      }),
    ).toBe('commercial');
    expect(professionOfText('Senior Java Developer')).toBe('software');
  });

  it('asks the configured model whether the job fits', async () => {
    process.env.XAI_MODEL = 'grok-4.7';
    const create = async (body: { model: string }) => {
      expect(body.model).toBe('grok-4.7');
      return { choices: [{ message: { content: '{"sameProfession":true,"fit":84}' } }] };
    };
    const verdict = await judgeJobFit({ chat: { completions: { create } } } as never, {
      profession: 'commercial',
      cvLines: ['Assistant Manager — Category & Revenue Management'],
      title: 'Category Manager',
      company: 'Acme',
      skills: [],
      description: 'Own the category.',
    });
    expect(verdict).toEqual({ sameProfession: true, fit: 84 });
  });

  it('parses a fit verdict and rejects a wrong profession', () => {
    expect(parseFitVerdict('{"sameProfession":false,"fit":90}')).toEqual({
      sameProfession: false,
      fit: 90,
    });
    expect(parseFitVerdict('nope')).toBeNull();
  });
});
