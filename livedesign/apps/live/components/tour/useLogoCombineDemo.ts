'use client';

import { useEffect } from 'react';
import {
  createShape,
  layOutPages,
  pagesOf,
  type BoxedElement,
  type Element,
} from '@livedesign/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useOptionalSelectionStore } from '@/hooks/canvas/useSelectionStore';
import { useLatest } from '@/hooks/ui/useLatest';
import { combineElements } from '@/lib/combine/combine';
import { debugLog } from '@/lib/debug-log';
import { deriveNewBoxedColours } from '@/lib/themes';
import { registerCombineDemo } from './logo-combine-demo';
import { waitForSelector } from './tour-dom';

// The two shapes' size, against the page's shorter side, and how far down the page they sit: in its lower third, clear
// of a template's own mark, which sits in the middle.
const DEMO_SIZE_OF_PAGE = 0.18;
const DEMO_DEPTH = 0.78;
const COMBINE_BUTTON = '[aria-label="Combine shapes"]';

// The editor's side of the Logo tour's Combine demonstration (logo-combine-demo.ts): mounted once in the editor, beside
// the Pages tour, it places, unites and clears the shapes on the active tab.
export function useLogoCombineDemo(): void {
  const ctx = useEditorContext();
  const store = useOptionalSelectionStore();
  const live = useLatest({ ctx, store });
  useEffect(() => {
    let placed: string[] = [];
    const select = (selectedId: string | null, many: readonly string[]) =>
      live.current.store?.setSelection({ selectedId, multiSelectedIds: new Set(many) });
    registerCombineDemo({
      place: async (pageId) => {
        const { ctx: c } = live.current;
        const page = layOutPages(pagesOf(c.activeTab)).find((p) => p.id === pageId);
        if (!page) return false;
        const { x, y, width, height } = page.rect;
        const size = Math.round(Math.min(width, height) * DEMO_SIZE_OF_PAGE);
        const cx = x + width / 2;
        const cy = y + height * DEMO_DEPTH;
        const colour = (el: Element) => ({
          ...el,
          ...deriveNewBoxedColours(el as BoxedElement, {
            backgroundColor: c.activeTab.backgroundColor,
            patternColor: c.activeTab.patternColor,
            theme: c.activeTab.theme,
          }),
        });
        // A square and a circle overlapping by half, side by side across the page, low down.
        const square = colour({
          ...createShape('square', 0, 0),
          x: cx - size * 0.75,
          y: cy - size / 2,
          width: size,
          height: size,
        });
        const circle = colour({
          ...createShape('circle', 0, 0),
          x: cx - size * 0.25,
          y: cy - size / 2,
          width: size,
          height: size,
        });
        c.tourSquare.place(square, circle);
        placed = [square.id, circle.id];
        select(null, placed);
        return (await waitForSelector(COMBINE_BUTTON, 2000)) !== null;
      },
      unite: async () => {
        const { ctx: c } = live.current;
        const ordered = c.activeTab.elements.filter((el) =>
          placed.includes(el.id),
        ) as BoxedElement[];
        const result = await combineElements(ordered, 'unite', crypto.randomUUID());
        if (!result.ok) {
          debugLog('[pages-tour] combine demo failed', { reason: result.reason });
          return false;
        }
        c.tourSquare.replace(placed, result.path);
        placed = [result.path.id];
        select(result.path.id, []);
        return true;
      },
      shape: () => (placed.length === 1 ? placed[0]! : null),
      clear: () => {
        placed = [];
        if (live.current.ctx.tourSquare.remove().length > 0) select(null, []);
      },
    });
    return () => registerCombineDemo(null);
  }, [live]);
}
