import { describe, expect, it } from 'vitest';
import {
  assertPublicJobUrl,
  openingFromHtml,
  openingFromModel,
} from '../src/jobs/opening-parse.js';

const PAGE = `
<html><head></head><body>
<script type="application/ld+json">
{"@type":"JobPosting","title":"Category Manager","hiringOrganization":{"name":"Electrolux Group"},"description":"Own the category. Write to nina@electrolux.com","jobLocation":{"address":{"addressLocality":"Pune"}}}
</script>
</body></html>`;

describe('opening parse', () => {
  it('reads a job posting from the page', () => {
    const opening = openingFromHtml(PAGE, 'https://jobs.example.com/1');
    expect(opening?.company).toBe('Electrolux Group');
    expect(opening?.title).toBe('Category Manager');
    expect(opening?.email).toBe('nina@electrolux.com');
    expect(opening?.location).toBe('Pune');
  });

  it('reads a model reply and ignores a page that is not a job', () => {
    expect(
      openingFromModel(
        '{"isJob":true,"company":"Zepto","title":"Category Manager","description":"","email":"","url":""}',
        'https://zepto.com/jobs/1',
      )?.company,
    ).toBe('Zepto');
    expect(
      openingFromModel('{"isJob":false,"company":"Zepto","title":"Category Manager"}', null),
    ).toBeNull();
  });

  it('refuses a private or local address', () => {
    expect(() => assertPublicJobUrl('http://127.0.0.1/job')).toThrow('blocked-url');
    expect(() => assertPublicJobUrl('http://169.254.169.254/latest')).toThrow('blocked-url');
    expect(() => assertPublicJobUrl('file:///etc/passwd')).toThrow('bad-url');
    expect(assertPublicJobUrl('https://jobs.electrolux.com/role').hostname).toBe(
      'jobs.electrolux.com',
    );
  });
});
