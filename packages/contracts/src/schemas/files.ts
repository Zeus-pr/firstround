import { z } from 'zod';

export const FILE_PURPOSES = ['cv', 'avatar', 'attachment'] as const;
export const FilePurpose = z.enum(FILE_PURPOSES);
export type FilePurpose = z.infer<typeof FilePurpose>;

export const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const UploadUrlRequest = z.object({
  purpose: FilePurpose,
  contentType: z.enum(ALLOWED_CONTENT_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
  /** Tenant/user prefix until Nest Firebase auth is wired. */
  ownerId: z.string().trim().min(1).max(128),
});
export type UploadUrlRequest = z.infer<typeof UploadUrlRequest>;

export const UploadUrlResponse = z.object({
  fileKey: z.string(),
  uploadUrl: z.string().url(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.string(),
});
export type UploadUrlResponse = z.infer<typeof UploadUrlResponse>;

export const DownloadUrlRequest = z.object({
  fileKey: z.string().min(1).max(400),
  ownerId: z.string().trim().min(1).max(128),
});
export type DownloadUrlRequest = z.infer<typeof DownloadUrlRequest>;

export const DownloadUrlResponse = z.object({
  downloadUrl: z.string().url(),
  expiresAt: z.string(),
});
export type DownloadUrlResponse = z.infer<typeof DownloadUrlResponse>;

export const FilesStatus = z.object({
  ok: z.boolean(),
  configured: z.boolean(),
  bucket: z.string().nullable(),
});
export type FilesStatus = z.infer<typeof FilesStatus>;
