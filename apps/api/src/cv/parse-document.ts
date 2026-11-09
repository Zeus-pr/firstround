import mammoth from 'mammoth';

const MAX_CHARS = 120_000;

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
    const text = (parsed.text ?? '').replace(/\u0000/g, '').trim();
    return { text: text.slice(0, MAX_CHARS), pageEstimate: parsed.numpages ?? 0 };
  }
  if (
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    contentType === 'application/msword'
  ) {
    const parsed = await mammoth.extractRawText({ buffer: bytes });
    const text = (parsed.value ?? '').replace(/\u0000/g, '').trim();
    return {
      text: text.slice(0, MAX_CHARS),
      pageEstimate: Math.max(1, Math.ceil(text.length / 3000)),
    };
  }
  throw new Error(`Unsupported content type: ${contentType}`);
}
