import { describe, expect, it } from 'vitest';
import { companyKey, pickHrContact, sameCompany, type HrContact } from '../src/jobs/hr-contacts.js';

const contacts: HrContact[] = [
  {
    fullName: 'Ada Head',
    title: 'Head HR',
    companyName: 'Urban Company',
    email: 'ada@urbancompany.com',
  },
  {
    fullName: 'Bea Talent',
    title: 'Head of Talent Acquisition',
    companyName: 'Urban Company (UC)',
    email: 'bea@urbancompany.com',
  },
  {
    fullName: 'Cara Other',
    title: 'Head HR',
    companyName: 'Other Labs Pvt Ltd',
    email: 'cara@otherlabs.com',
  },
];

describe('HR company pool', () => {
  it('treats a legal suffix and a parenthetical as the same company', () => {
    expect(companyKey('Urban Company (UC)')).toBe(companyKey('Urban Company'));
    expect(companyKey('Other Labs Pvt. Ltd.')).toBe('other labs');
  });

  it('picks the talent-acquisition contact when the company matches', () => {
    expect(pickHrContact('Urban Company', contacts)?.email).toBe('bea@urbancompany.com');
  });

  it('stays blank when the company is not in the pool', () => {
    expect(pickHrContact('Samsung', contacts)).toBeNull();
    expect(pickHrContact('   ', contacts)).toBeNull();
  });

  it('matches a spacing difference and a trailing company word', () => {
    expect(sameCompany('Drink Prime', 'DrinkPrime')).toBe(true);
    expect(sameCompany('Design Cafe', 'DesignCafe')).toBe(true);
    expect(sameCompany('SourceFuse', 'SourceFuse Technologies')).toBe(true);
    expect(sameCompany('Qualizeal India', 'QualiZeal')).toBe(true);
    expect(
      pickHrContact('SourceFuse', [
        {
          fullName: 'Neel Talent',
          title: 'Head of Talent Acquisition',
          companyName: 'SourceFuse Technologies',
          email: 'neel@sourcefuse.com',
        },
      ])?.email,
    ).toBe('neel@sourcefuse.com');
  });

  it('stays blank when a close spelling is a different company', () => {
    expect(sameCompany('Affinity Global', 'Infinity')).toBe(false);
    expect(sameCompany('Tata Motors', 'Ati Motors')).toBe(false);
    expect(sameCompany('Opus Technologies', 'Opus Consulting Solutions')).toBe(false);
    expect(
      pickHrContact('Nitor', [
        {
          fullName: 'Asha HR',
          title: 'Head HR',
          companyName: 'Nitor Infotech',
          email: 'asha@nitor.com',
        },
        {
          fullName: 'Bea HR',
          title: 'Head HR',
          companyName: 'Nitor Systems',
          email: 'bea@nitorsystems.com',
        },
      ]),
    ).toBeNull();
  });
});
