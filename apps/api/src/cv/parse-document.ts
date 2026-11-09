import type { ParseQuality } from '@firstround/contracts';
import mammoth from 'mammoth';
import { ocrPages } from './ocr.js';
import { renderPdfPages } from './pdf-render.js';

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

function assessText(
  text: string,
  pageEstimate: number,
): {
  sparseText: boolean;
  multiColumnSuspected: boolean;
  quality: ParseQuality['quality'];
} {
  const chars = text.length;
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const shortLines = lines.filter((l) => l.length > 0 && l.length < 28).length;
  const shortRatio = lines.length ? shortLines / lines.length : 1;
  const avgLine = lines.length ? chars / lines.length : 0;
  // Interleaved short lines + decent total length often means broken column order.
  const multiColumnSuspected = lines.length > 25 && shortRatio > 0.45 && avgLine < 42;
  const sparseText = chars < 280 || (pageEstimate > 0 && chars / Math.max(pageEstimate, 1) < 180);
  let quality: ParseQuality['quality'] = 'high';
  if (sparseText || multiColumnSuspected) quality = 'low';
  else if (chars < 900 || shortRatio > 0.35) quality = 'medium';
  return { sparseText, multiColumnSuspected, quality };
}

export type ParsedCv = {
  text: string;
  pageEstimate: number;
  pages: Awaited<ReturnType<typeof renderPdfPages>>;
  parse: ParseQuality;
};

export async function extractTextFromCv(bytes: Buffer, contentType: string): Promise<ParsedCv> {
  if (contentType === 'application/pdf') {
    return extractPdf(bytes);
  }
  if (
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    contentType === 'application/msword'
  ) {
    const parsed = await mammoth.extractRawText({ buffer: bytes });
    const text = stripNul(parsed.value ?? '').slice(0, MAX_CHARS);
    const pageEstimate = Math.max(1, Math.ceil(text.length / 3000));
    const assess = assessText(text, pageEstimate);
    return {
      text,
      pageEstimate,
      pages: [],
      parse: {
        method: 'text',
        textChars: text.length,
        pageEstimate,
        pagesRendered: 0,
        multiColumnSuspected: assess.multiColumnSuspected,
        sparseText: assess.sparseText,
        ocrUsed: false,
        visionUsed: false,
        quality: assess.quality,
        notes: assess.sparseText ? ['Word extract looked thin.'] : [],
      },
    };
  }
  throw new Error(`Unsupported content type: ${contentType}`);
}

async function extractPdf(bytes: Buffer): Promise<ParsedCv> {
  const pdf = await loadPdfParse();
  const parsed = await pdf(bytes);
  let text = stripNul(parsed.text ?? '');
  const pageEstimate = parsed.numpages ?? 0;
  let assess = assessText(text, pageEstimate);
  const notes: string[] = [];
  let ocrUsed = false;
  let pages: Awaited<ReturnType<typeof renderPdfPages>> = [];
  let method: ParseQuality['method'] = 'text';

  if (assess.sparseText || assess.multiColumnSuspected) {
    pages = await renderPdfPages(bytes, 3);
    if (pages.length > 0) {
      const ocrText = await ocrPages(pages);
      ocrUsed = ocrText.length > 0;
      if (ocrText.length > text.length * 0.8) {
        text = ocrText;
        method = 'ocr';
        notes.push('Used OCR because the PDF text layer was thin or column-scrambled.');
      } else if (ocrText.length > 80) {
        text = `${text}\n\n${ocrText}`.trim();
        method = 'hybrid';
        notes.push('Merged PDF text with OCR for harder pages.');
      } else {
        notes.push('OCR ran but added little; keeping the text layer.');
      }
      assess = assessText(text, pageEstimate || pages.length);
    } else {
      notes.push('Could not render PDF pages for OCR; continuing with the text layer.');
    }
  }

  text = text.slice(0, MAX_CHARS);
  return {
    text,
    pageEstimate: pageEstimate || pages.length || 1,
    pages,
    parse: {
      method,
      textChars: text.length,
      pageEstimate: pageEstimate || pages.length || 1,
      pagesRendered: pages.length,
      multiColumnSuspected: assess.multiColumnSuspected,
      sparseText: assess.sparseText,
      ocrUsed,
      visionUsed: false,
      quality: assess.quality,
      notes,
    },
  };
}
