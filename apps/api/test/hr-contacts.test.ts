import { describe, expect, it } from 'vitest';
import { companyKey, pickHrContact, type HrContact } from '../src/jobs/hr-contacts.js';

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
});
