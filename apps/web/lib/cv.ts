import type { User } from 'firebase/auth';
import { apiUrl } from './api-url';

export type ReadinessBand = 'ready' | 'supercharge' | 'strengthen';

export type ReadinessResult = {
  total: number;
  dimensions: {
    evidenceCompleteness: number;
    outcomeQuality: number;
    targetRoleCoverage: number;
    careerConsistency: number;
    communicationClarity: number;
  };
  gaps: string[];
  genuineGaps: string[];
  underEmphasised: string[];
  checks: { id: string; label: string; passed: boolean; severity: 'soft' | 'hard' }[];
  sendability: {
    ok: boolean;
    hasEmail: boolean;
    hasLocation: boolean;
    hasWorkingLink: boolean;
    blockers: string[];
  };
  confidence: { overall: number; notes: string[] };
  parse: {
    method: string;
    quality: string;
    ocrUsed: boolean;
    visionUsed: boolean;
    multiColumnSuspected: boolean;
    notes: string[];
  };
  recommendation: {
    action: 'continue' | 'supercharge' | 'strengthen';
    headline: string;
    body: string;
  };
  band: ReadinessBand;
  algorithmVersion: string;
};

export type AnalyzeCvResponse = {
  ok: true;
  cvDocumentId: string;
  extractionId: string;
  readiness: ReadinessResult;
  onboardingStep: string;
};

async function authHeaders(user: User): Promise<HeadersInit> {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

const CV_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function acceptCvFile(file: File): string | null {
  if (!CV_TYPES.has(file.type) && !/\.(pdf|docx?)$/i.test(file.name)) {
    return 'Use a PDF or Word file.';
  }
  if (file.size > 10 * 1024 * 1024) return 'Keep the file under 10 MB.';
  return null;
}

export async function uploadAndAnalyzeCv(user: User, file: File): Promise<AnalyzeCvResponse> {
  const contentType = file.type || 'application/pdf';
  const headers = await authHeaders(user);

  const uploadRes = await fetch(apiUrl('/files/upload-url'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      purpose: 'cv',
      contentType,
      sizeBytes: file.size,
    }),
  });
  if (!uploadRes.ok) {
    throw new Error(`Could not open an upload seat (${uploadRes.status})`);
  }
  const upload = (await uploadRes.json()) as {
    fileKey: string;
    uploadUrl: string;
    headers: Record<string, string>;
  };

  const put = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: upload.headers,
    body: file,
  });
  if (!put.ok) throw new Error('Upload to storage failed. Try again.');

  const registerRes = await fetch(apiUrl('/cv/register'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fileKey: upload.fileKey,
      contentType,
      sizeBytes: file.size,
      originalFilename: file.name,
    }),
  });
  if (!registerRes.ok) {
    throw new Error(`Could not register the CV (${registerRes.status})`);
  }
  const registered = (await registerRes.json()) as { cvDocumentId: string };

  const analyzeRes = await fetch(apiUrl('/cv/analyze'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ cvDocumentId: registered.cvDocumentId }),
  });
  if (analyzeRes.status === 503) {
    throw new Error('Analysis is not configured yet. Ask ops to set XAI_API_KEY on the API.');
  }
  if (!analyzeRes.ok) {
    const body = (await analyzeRes.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Analysis failed (${analyzeRes.status})`);
  }
  return (await analyzeRes.json()) as AnalyzeCvResponse;
}
