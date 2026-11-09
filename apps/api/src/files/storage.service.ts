import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import type {
  DownloadUrlResponse,
  FilePurpose,
  UploadUrlRequest,
  UploadUrlResponse,
} from '@firstround/contracts';

const EXT: Record<UploadUrlRequest['contentType'], string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

export const UPLOAD_TTL_S = 600;
export const DOWNLOAD_TTL_S = 300;

export interface StorageEnv {
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  R2_ENDPOINT?: string;
}

/**
 * Cloudflare R2 via the S3 API. The API never proxies file bytes: clients PUT/GET
 * directly with short-lived presigned URLs.
 * Key layout: `<purpose>/<ownerId>/<yyyy>/<mm>/<uuid>.<ext>`
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client | null;
  private readonly bucket: string | null;

  constructor() {
    // Read process.env directly — Nest must not treat StorageEnv as a DI token.
    const env: StorageEnv = process.env;
    const endpoint =
      env.R2_ENDPOINT ??
      (env.R2_ACCOUNT_ID ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);
    const ok = Boolean(
      endpoint && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET,
    );
    this.bucket = ok ? env.R2_BUCKET! : null;
    this.client = ok
      ? new S3Client({
          region: 'auto',
          endpoint,
          credentials: {
            accessKeyId: env.R2_ACCESS_KEY_ID!,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
          },
        })
      : null;
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.bucket);
  }

  bucketName(): string | null {
    return this.bucket;
  }

  private ready() {
    if (!this.client || !this.bucket) {
      throw new HttpException('File storage is not configured', 503);
    }
    return { client: this.client, bucket: this.bucket };
  }

  async status(): Promise<{ ok: boolean; configured: boolean; bucket: string | null }> {
    if (!this.isConfigured()) {
      return { ok: false, configured: false, bucket: null };
    }
    const { client, bucket } = this.ready();
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      return { ok: true, configured: true, bucket };
    } catch {
      return { ok: false, configured: true, bucket };
    }
  }

  async uploadUrl(
    req: UploadUrlRequest & { ownerId: string },
    now = new Date(),
  ): Promise<UploadUrlResponse> {
    return this.presignPut(req.ownerId, req.purpose, req.contentType, req.sizeBytes, now);
  }

  async presignPut(
    ownerId: string,
    purpose: FilePurpose,
    contentType: UploadUrlRequest['contentType'],
    sizeBytes: number,
    now = new Date(),
  ): Promise<UploadUrlResponse> {
    const { client, bucket } = this.ready();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const ext = EXT[contentType];
    const fileKey = `${purpose}/${ownerId}/${now.getUTCFullYear()}/${mm}/${randomUUID()}.${ext}`;
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: fileKey,
      ContentType: contentType,
      ContentLength: sizeBytes,
    });
    const uploadUrl = await getSignedUrl(client, cmd, {
      expiresIn: UPLOAD_TTL_S,
      signableHeaders: new Set(['content-type', 'content-length']),
    });
    return {
      fileKey,
      uploadUrl,
      method: 'PUT',
      headers: { 'content-type': contentType, 'content-length': String(sizeBytes) },
      expiresAt: new Date(now.getTime() + UPLOAD_TTL_S * 1000).toISOString(),
    };
  }

  async head(fileKey: string): Promise<{ sizeBytes: number; contentType: string | null } | null> {
    const { client, bucket } = this.ready();
    try {
      const h = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: fileKey }));
      return { sizeBytes: Number(h.ContentLength ?? 0), contentType: h.ContentType ?? null };
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return null;
      throw e;
    }
  }

  async remove(fileKey: string): Promise<void> {
    const { client, bucket } = this.ready();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: fileKey }));
  }

  async downloadUrl(
    ownerId: string,
    fileKey: string,
    now = new Date(),
  ): Promise<DownloadUrlResponse> {
    // Keys are purpose/ownerId/yyyy/mm/uuid.ext — never trust a client-owned path.
    if (
      !ownerId ||
      fileKey.includes('..') ||
      fileKey.includes('\\') ||
      fileKey.startsWith('/') ||
      fileKey.split('/')[1] !== ownerId
    ) {
      throw new NotFoundException('File not found');
    }
    const { client, bucket } = this.ready();
    const downloadUrl = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: fileKey }),
      { expiresIn: DOWNLOAD_TTL_S },
    );
    return {
      downloadUrl,
      expiresAt: new Date(now.getTime() + DOWNLOAD_TTL_S * 1000).toISOString(),
    };
  }
}
