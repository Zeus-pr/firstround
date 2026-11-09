import type {
  JobSourceProvider,
  MailSenderProvider,
  VerifierProvider,
} from '@/lib/providers/types';

export class FakeJobSource implements JobSourceProvider {
  readonly name = 'fake-jobs';

  async fetchBatch({ limit }: { query: string; limit: number }) {
    return Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
      sourceKey: 'fake',
      externalId: `job-${i + 1}`,
      title: `Role ${i + 1}`,
      company: 'Example Co',
      capturedAt: new Date().toISOString(),
    }));
  }
}

export class FakeVerifier implements VerifierProvider {
  readonly name = 'fake-verifier';

  async verify(email: string) {
    const invalid = email.endsWith('@invalid.test');
    return {
      email,
      status: invalid ? ('invalid' as const) : ('valid' as const),
      score: invalid ? 0.1 : 0.96,
      provider: this.name,
    };
  }
}

export class FakeMailSender implements MailSenderProvider {
  readonly name = 'fake-mail';
  readonly sent: Array<{ to: string; subject: string }> = [];

  async send(input: { to: string; subject: string; bodyText: string; threadId?: string }) {
    this.sent.push({ to: input.to, subject: input.subject });
    const threadId = input.threadId ?? `thread-${this.sent.length}`;
    return { messageId: `msg-${this.sent.length}`, threadId };
  }
}
