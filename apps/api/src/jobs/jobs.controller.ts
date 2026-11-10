import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { OpsTokenGuard } from '../auth/ops-token.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { JobsService } from './jobs.service.js';

const IngestBody = z.object({
  keywords: z.string().trim().min(2).max(120),
  location: z.string().trim().max(120).optional(),
  maxJobs: z.number().int().min(1).max(200).optional(),
});

const SourceKeyParam = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.enum(['naukri_apify', 'linkedin_apify']));

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get('corpus/status')
  @UseGuards(FirebaseAuthGuard)
  corpusStatus() {
    return this.jobs.corpusStatus();
  }

  @Get('canonical')
  @UseGuards(FirebaseAuthGuard)
  listCanonical(
    @Query('limit') limit?: string,
    @Query('includeQuarantined') includeQuarantined?: string,
  ) {
    return this.jobs.listCanonical({
      limit: limit ? Number(limit) : undefined,
      includeQuarantined: includeQuarantined === '1' || includeQuarantined === 'true',
    });
  }

  @Post('ingest/:sourceKey')
  @UseGuards(OpsTokenGuard)
  ingest(
    @Param('sourceKey', new ZodPipe(SourceKeyParam)) sourceKey: 'naukri_apify' | 'linkedin_apify',
    @Body(new ZodPipe(IngestBody)) body: z.infer<typeof IngestBody>,
  ) {
    return this.jobs.startIngest(sourceKey, body);
  }
}
