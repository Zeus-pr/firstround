import mammoth from 'mammoth';

const MAX_CHARS = 120_000;
const NUL = String.fromCharCode(0);

function stripNul(value: string): string {
  return value.split(NUL).join('').trim();
}

type PdfParse = (data: Buffer) => Promise<{ text?: string; numpages?: number }>;

async function loadPdfParse(): Promise<PdfParse> {
  const mod = (await import('pdf-parse')) as unknown as PdfParse | { default: PdfParse };
  return typeof mod === 'function' ? mod : mod.default;
}

export async function extractTextFromCv(
  bytes: Buffer,
  contentType: string,
): Promise<{ text: string; pageEstimate: number }> {
  if (contentType === 'application/pdf') {
    const pdf = await loadPdfParse();
    const parsed = await pdf(bytes);
    const text = stripNul(parsed.text ?? '');
    return { text: text.slice(0, MAX_CHARS), pageEstimate: parsed.numpages ?? 0 };
  }
  if (
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    contentType === 'application/msword'
  ) {
    const parsed = await mammoth.extractRawText({ buffer: bytes });
    const text = stripNul(parsed.value ?? '');
    return {
      text: text.slice(0, MAX_CHARS),
      pageEstimate: Math.max(1, Math.ceil(text.length / 3000)),
    };
  }
  throw new Error(`Unsupported content type: ${contentType}`);
}
