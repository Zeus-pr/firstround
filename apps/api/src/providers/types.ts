export type JobPosting = {
  sourceKey: string;
  externalId: string;
  title: string;
  company: string;
  location?: string;
  url?: string;
  capturedAt: string;
};

export type VerifyResult = {
  email: string;
  status: 'valid' | 'invalid' | 'accept_all' | 'unknown' | 'disposable';
  score: number;
  provider: string;
};

export type SendMailInput = {
  to: string;
  subject: string;
  bodyText: string;
  threadId?: string;
};

export type SendMailResult = {
  messageId: string;
  threadId: string;
};

export interface JobSourceProvider {
  readonly name: string;
  fetchBatch(input: { query: string; limit: number }): Promise<JobPosting[]>;
}

export interface VerifierProvider {
  readonly name: string;
  verify(email: string): Promise<VerifyResult>;
}

export interface MailSenderProvider {
  readonly name: string;
  send(input: SendMailInput): Promise<SendMailResult>;
}
