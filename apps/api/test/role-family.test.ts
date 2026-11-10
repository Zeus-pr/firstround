import { describe, expect, it } from 'vitest';
import {
  allowedFamilies,
  familyOfText,
  otherNeedles,
  primaryFamily,
} from '../src/jobs/role-family.js';

describe('role family', () => {
  it('classifies titles by the role, not a nearby industry word', () => {
    expect(familyOfText('Java Developer')).toBe('software');
    expect(familyOfText('Backend Engineer')).toBe('software');
    expect(familyOfText('Frontend Engineer, E-commerce')).toBe('software');
    expect(familyOfText('Senior Engineer')).toBe('software');
    expect(familyOfText('Data Engineer')).toBe('data');
    expect(familyOfText('Data Analyst')).toBe('data');
    expect(familyOfText('Product Manager')).toBe('product');
    expect(familyOfText('UI/UX Designer')).toBe('design');
    expect(familyOfText('Category Demand Management')).toBe('commercial');
    expect(familyOfText('Assistant Manager - Business Finance (Revenue)')).toBe('commercial');
    expect(familyOfText('AM_Merchandising')).toBe('commercial');
    expect(familyOfText('Civil Engineer')).toBe('other');
    expect(familyOfText('Project Fiber Engineer')).toBe('other');
    expect(familyOfText('Sales Engineer')).toBe('other');
    expect(familyOfText('Luxury Sales Manager')).toBe('other');
    expect(familyOfText('Research Intern')).toBe('other');
  });

  it('keeps the current commercial role over an older engineering title', () => {
    expect(
      primaryFamily({
        targetRoleHints: ['Category & Revenue Management', 'GTM Strategy'],
        roles: [
          { title: 'Assistant Manager — Category & Revenue Management', isCurrent: true },
          { title: 'Product & Machine Learning Engineer', isCurrent: false },
        ],
      }),
    ).toBe('commercial');
  });

  it('uses a stronger hint when the current title is only context', () => {
    expect(
      primaryFamily({
        targetRoleHints: ['Full Stack Developer'],
        roles: [{ title: 'E-commerce Intern', isCurrent: true }],
      }),
    ).toBe('software');
    expect(
      primaryFamily({
        targetRoleHints: ['Full Stack Developer'],
        roles: [{ title: 'Research Intern', isCurrent: true }],
      }),
    ).toBe('software');
  });

  it('reads skills only when titles and hints have no family', () => {
    expect(
      primaryFamily({
        roles: [{ title: 'Consultant', isCurrent: true }],
        skills: ['React', 'Node.js'],
      }),
    ).toBe('software');
    expect(
      primaryFamily({ roles: [{ title: 'Consultant', isCurrent: true }], skills: ['Excel'] }),
    ).toBe('other');
  });

  it('searches title words for professions we do not model', () => {
    expect(otherNeedles({ roles: [{ title: 'Training Manager', isCurrent: true }] })).toEqual([
      'training',
    ]);
    expect(otherNeedles({ roles: [{ title: 'Executive HR & Admin', isCurrent: true }] })).toEqual(
      expect.arrayContaining(['hr', 'admin']),
    );
    expect(otherNeedles({ roles: [{ title: 'Senior Manager', isCurrent: true }] })).toEqual([]);
  });

  it('adds an explicit preference family without dropping the CV family', () => {
    const families = allowedFamilies(
      {
        roles: [{ title: 'Category Manager', isCurrent: true }],
      },
      ['backend'],
    );
    expect(families).toContain('commercial');
    expect(families).toContain('software');
  });
});
