import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  DownloadUrlRequest,
  UploadUrlRequest,
  type DownloadUrlResponse,
  type FilesStatus,
  type UploadUrlResponse,
} from '@firstround/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { StorageService } from './storage.service.js';

@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Get('status')
  status(): Promise<FilesStatus> {
    return this.storage.status();
  }

  @Post('upload-url')
  @HttpCode(200)
  upload(@Body(new ZodPipe(UploadUrlRequest)) body: UploadUrlRequest): Promise<UploadUrlResponse> {
    return this.storage.uploadUrl(body);
  }

  @Post('download-url')
  @HttpCode(200)
  download(
    @Body(new ZodPipe(DownloadUrlRequest)) body: DownloadUrlRequest,
  ): Promise<DownloadUrlResponse> {
    return this.storage.downloadUrl(body.ownerId, body.fileKey);
  }
}
