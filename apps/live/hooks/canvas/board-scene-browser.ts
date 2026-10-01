// The browser halves of landing a board scene (docs/specs/020-import-export/board-scene.md "In the
// editor"), shared by paste (useBoardSceneInsert) and import (useBoardSceneImport): an image
// session, and the text hug in our fonts. Both are seams the hooks' tests replace.
import { resolveFontStack, type Element, type TextElement } from '@livediagram/document';
import type { ImportImageSession } from '@/lib/import-images';
import { hugLandedText, landedTextFonts } from '@/lib/board-scene-hug';
import type { MeasureTextBlock } from '@/lib/text-hug';

export type CreateImageSession = (o: {
  ownerId: string;
  documentId: string | null;
}) => Promise<ImportImageSession>;
export type HugText = (elements: Element[], tabFont: string | undefined) => Promise<Element[]>;

// Lazily, so the pipeline's DOM code stays out of the editor's first bundle.
export const browserImageSession: CreateImageSession = async (o) =>
  (await import('@/lib/import-images/browser')).createBrowserImportImageSession(o);

// The canvas's own measurer, once the faces the boxes draw in have loaded (a measure in a
// fallback face would hug the wrong width).
export const browserHugText: HugText = async (elements, tabFont) => {
  if (!elements.some((el) => el.type === 'text')) return elements;
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (fonts) {
    await Promise.all(
      landedTextFonts(elements, tabFont).map((id) => {
        const stack = resolveFontStack(id);
        return stack ? fonts.load(`16px ${stack}`).catch(() => []) : [];
      }),
    );
  }
  const { measureDrawnText } = await import('@/components/canvas/text-hug-measure');
  const measure: (el: TextElement) => MeasureTextBlock = measureDrawnText(tabFont);
  return hugLandedText(elements, measure);
};
