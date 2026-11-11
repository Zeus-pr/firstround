import { describe, expect, it } from 'vitest';
import { acceptInterest } from '../src/jobs/interest.js';
import { renderLetter } from '../src/jobs/letter-templates.js';

const source = `Amazon
Category Manager
The Produce category at Amazon Now sits inside a hyperlocal speed-of-delivery model.
Owned supply and allocation planning for 14 regional warehouses.`;

describe('role interest', () => {
  it('keeps two grounded sentences that name the company', () => {
    const text = acceptInterest(
      "I'm interested because the Produce category at Amazon sits inside a hyperlocal speed-of-delivery model. I owned supply and allocation planning for 14 regional warehouses.",
      source,
      'Amazon',
    );
    expect(text?.startsWith("I'm interested because")).toBe(true);
  });

  it('keeps a sentence that uses Rs. as an abbreviation', () => {
    expect(
      acceptInterest(
        "I'm interested because Amazon treats in-stock as a daily problem. I owned a Rs. 250 Cr portfolio with 22% growth.",
        `${source}\n250\n22`,
        'Amazon',
      ),
    ).toBeTruthy();
  });

  it('drops a sentence that invents a number or flatters', () => {
    expect(
      acceptInterest(
        "I'm interested because Amazon moves fast. I grew revenue 40%.",
        source,
        'Amazon',
      ),
    ).toBeNull();
    expect(
      acceptInterest(
        "I'm interested because I am passionate about Amazon's mission.",
        source,
        'Amazon',
      ),
    ).toBeNull();
  });

  it('places the interest after the proof and before the ask', () => {
    const letter = renderLetter({
      company: 'Amazon',
      role: 'Category Manager',
      sourceUrl: null,
      candidateName: 'Ada',
      phone: null,
      linkedin: null,
      bullets: ['Owned supply planning for 14 warehouses.'],
      interest:
        "I'm interested because Amazon Now treats in-stock as a daily problem. I owned supply planning for 14 warehouses.",
      shuffle: false,
      seed: 'a',
    });
    const body = letter.body;
    expect(body.indexOf('A bit about me:')).toBeLessThan(body.indexOf("I'm interested because"));
    expect(body.indexOf("I'm interested because")).toBeLessThan(
      body.indexOf('If you are still hiring'),
    );
  });
});
