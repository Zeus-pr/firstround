import { describe, expect, it } from 'vitest';
import { familyOfText, primaryFamily } from '../src/jobs/role-family.js';

describe('role family', () => {
  it('reads the current commercial role and ignores an older ML title', () => {
    const family = primaryFamily({
      targetRoleHints: ['Category & Revenue Management', 'GTM Strategy'],
      roles: [
        {
          title: 'Assistant Manager — Category & Revenue Management',
          isCurrent: true,
        },
        { title: 'Product & Machine Learning Engineer', isCurrent: false },
      ],
    });
    expect(family).toBe('commercial');
    expect(familyOfText('Java Developer')).toBe('software');
    expect(familyOfText('Backend Engineer')).toBe('software');
    expect(familyOfText('Category Demand Management')).toBe('commercial');
    expect(familyOfText('Assistant Manager - Business Finance (Revenue)')).toBe('commercial');
    expect(familyOfText('AM_Merchandising')).toBe('commercial');
  });

  it('uses hints when the latest title is generic', () => {
    expect(
      primaryFamily({
        targetRoleHints: ['Full Stack Developer'],
        roles: [{ title: 'Research Intern', isCurrent: true }],
      }),
    ).toBe('software');
  });
});
