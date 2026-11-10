import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../auth/auth-user.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { SessionService } from '../session/session.service.js';
import {
  evaluateGates,
  evaluateHardFilters,
  GATE_THRESHOLDS,
  GATES_ALGORITHM_VERSION,
} from './gates.js';

const GateBody = z.object({
  jobTrustScore: z.number().min(0).max(100),
  jobMatchScore: z.number().min(0).max(100),
  personJobScore: z.number().min(0).max(100).optional(),
  addressIdentityScore: z.number().min(0).max(100).optional(),
  mailboxConfidenceScore: z.number().min(0).max(100),
  mailboxStatus: z.enum(['valid', 'accept_all', 'unknown', 'invalid', 'disposable']),
  invitedChannel: z
    .object({
      address: z.string().min(3),
      inSourceText: z.boolean(),
    })
    .nullable()
    .optional(),
  addressProvenance: z.enum(['published-with-url', 'inferred', 'direct-public']),
  inferredAddressPolicyEnabled: z.boolean().optional(),
  verificationAttemptCount: z.number().int().min(0).max(10),
  preferences: z
    .object({
      workAuthorization: z.string().nullable().optional(),
      targetLevel: z.string().nullable().optional(),
      locations: z.array(z.string()).optional(),
      remoteOk: z.boolean().optional(),
    })
    .optional(),
  job: z
    .object({
      workAuthorizationRequired: z.string().nullable().optional(),
      seniorityLevel: z.string().nullable().optional(),
      location: z.string().nullable().optional(),
      workMode: z.enum(['remote', 'hybrid', 'onsite']).nullable().optional(),
      closed: z.boolean().optional(),
    })
    .optional(),
});

@Controller('gates')
export class GatesController {
  constructor(private readonly sessions: SessionService) {}

  @Post('evaluate')
  @UseGuards(FirebaseAuthGuard)
  async evaluate(
    @CurrentUser() auth: AuthUser,
    @Body(new ZodPipe(GateBody)) body: z.infer<typeof GateBody>,
  ) {
    await this.sessions.ensureUser(auth);
    if (body.preferences && body.job) {
      const hard = evaluateHardFilters(body.preferences, body.job);
      if (!hard.ok) {
        return {
          ok: true as const,
          overallPass: false,
          shortlistEligible: false,
          skipReason: hard.reason,
          thresholds: GATE_THRESHOLDS,
          algorithmVersion: GATES_ALGORITHM_VERSION,
          decisions: [],
        };
      }
    }
    const result = evaluateGates({
      jobTrustScore: body.jobTrustScore,
      jobMatchScore: body.jobMatchScore,
      personJobScore: body.personJobScore,
      addressIdentityScore: body.addressIdentityScore,
      mailboxConfidenceScore: body.mailboxConfidenceScore,
      mailboxStatus: body.mailboxStatus,
      invitedChannel: body.invitedChannel,
      addressProvenance: body.addressProvenance,
      inferredAddressPolicyEnabled: body.inferredAddressPolicyEnabled,
      verificationAttemptCount: body.verificationAttemptCount,
    });
    return {
      ok: true as const,
      thresholds: GATE_THRESHOLDS,
      algorithmVersion: GATES_ALGORITHM_VERSION,
      ...result,
    };
  }
}
