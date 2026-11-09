import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

const MAX_PAGES = 3;
const SCALE = 1.5;

export type RenderedPage = {
  page: number;
  png: Buffer;
  width: number;
  height: number;
};

/**
 * Render the first pages of a PDF to PNG for Grok vision.
 * Soft-fails: callers treat empty results as "text-only path".
 */
export async function renderPdfPages(bytes: Buffer, maxPages = MAX_PAGES): Promise<RenderedPage[]> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
      isEvalSupported: false,
      useWorkerFetch: false,
      isOffscreenCanvasSupported: false,
    });
    const doc = await loadingTask.promise;
    const count = Math.min(doc.numPages, maxPages);
    const pages: RenderedPage[] = [];

    for (let pageNum = 1; pageNum <= count; pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: SCALE });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d') as SKRSContext2D;
      await page.render({
        canvasContext: context as unknown as {
          canvas: { width: number; height: number };
          fillRect: (...args: unknown[]) => void;
        },
        viewport,
      }).promise;
      pages.push({
        page: pageNum,
        png: canvas.toBuffer('image/png'),
        width: canvas.width,
        height: canvas.height,
      });
    }
    return pages;
  } catch {
    return [];
  }
}
