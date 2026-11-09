import { describe, expect, it } from 'vitest';
import { FakeJobSource, FakeMailSender, FakeVerifier } from '../src/providers/fakes.js';

describe('fake providers', () => {
  it('returns job postings', async () => {
    const jobs = await new FakeJobSource().fetchBatch({ query: 'analyst', limit: 2 });
    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.sourceKey).toBe('fake');
  });

  it('verifies addresses', async () => {
    const verifier = new FakeVerifier();
    await expect(verifier.verify('ok@example.com')).resolves.toMatchObject({ status: 'valid' });
    await expect(verifier.verify('x@invalid.test')).resolves.toMatchObject({ status: 'invalid' });
  });

  it('records sends', async () => {
    const mail = new FakeMailSender();
    const result = await mail.send({ to: 'a@b.com', subject: 'Hi', bodyText: 'Body' });
    expect(result.messageId).toBeTruthy();
    expect(mail.sent).toHaveLength(1);
  });
});
