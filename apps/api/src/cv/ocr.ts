import type { RenderedPage } from './pdf-render.js';

/**
 * OCR rendered PDF pages. Soft-fails to empty string so analyze never crashes.
 */
export async function ocrPages(pages: RenderedPage[]): Promise<string> {
  if (pages.length === 0) return '';
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    const chunks: string[] = [];
    try {
      for (const page of pages) {
        const result = await worker.recognize(page.png);
        const text = (result.data.text ?? '').trim();
        if (text) chunks.push(text);
      }
    } finally {
      await worker.terminate();
    }
    return chunks.join('\n\n').trim();
  } catch {
    return '';
  }
}
