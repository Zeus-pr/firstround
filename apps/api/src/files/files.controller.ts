import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  DownloadUrlRequest,
  UploadUrlRequest,
  type DownloadUrlResponse,
  type FilesStatus,
  type UploadUrlResponse,
} from '@firstround/contracts';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { clientIp, createIpRateLimiter } from '../auth/rate-limit.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { StorageService } from './storage.service.js';

/** Per IP: minting signed URLs is cheap but abuse-prone. */
const allowFiles = createIpRateLimiter(60, 60 * 60 * 1000);

@Controller('files')
@UseGuards(FirebaseAuthGuard)
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  private assertRate(req: Request) {
    if (!allowFiles(clientIp(req))) {
      throw new ServiceUnavailableException({
        error: 'Too many file requests. Wait a while, then try again.',
      });
    }
  }

  @Get('status')
  status(@Req() req: Request): Promise<FilesStatus> {
    this.assertRate(req);
    return this.storage.status();
  }

  @Post('upload-url')
  @HttpCode(200)
  upload(
    @Req() req: Request,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(UploadUrlRequest)) body: UploadUrlRequest,
  ): Promise<UploadUrlResponse> {
    this.assertRate(req);
    return this.storage.uploadUrl({
      purpose: body.purpose,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      ownerId: user.uid,
    });
  }

  @Post('download-url')
  @HttpCode(200)
  download(
    @Req() req: Request,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(DownloadUrlRequest)) body: DownloadUrlRequest,
  ): Promise<DownloadUrlResponse> {
    this.assertRate(req);
    return this.storage.downloadUrl(user.uid, body.fileKey);
  }
}
