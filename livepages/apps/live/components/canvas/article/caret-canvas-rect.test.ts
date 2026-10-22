import { describe, expect, it } from 'vitest';
import type { EditorView } from 'prosemirror-view';
import type { LaidOutPage } from '@livepages/document';
import { flowFrame } from '@/lib/article/article-flow-geometry';
import { caretCanvasRect } from './article-editor-handle';

// docs/specs/007-editor/article-pages.md "Writing": the caret is kept in sight as it is written on, so where it is
// must read as a canvas rect, whatever the zoom.
const page = {
  id: 'p1',
  rect: { x: 1000, y: 200, width: 600, height: 800 },
} as unknown as LaidOutPage;

function viewAt(caret: { left: number; top: number; bottom: number }, throws = false): EditorView {
  return {
    state: { selection: { head: 3 } },
    coordsAtPos: () => {
      if (throws) throw new Error('not laid out');
      return { ...caret, right: caret.left };
    },
    // The writing's box on screen: 300 px wide for 600 canvas px, half zoom.
    dom: { getBoundingClientRect: () => ({ left: 50, top: 80, width: 300 }), offsetWidth: 600 },
  } as unknown as EditorView;
}

describe('caretCanvasRect', () => {
  const layout = { flow: 'a', pages: [page], margin: 48, zoom: 0.5 };

  it('maps the caret from screen to canvas by the writing scale', () => {
    const frame = flowFrame([page], 48);
    const rect = caretCanvasRect(viewAt({ left: 150, top: 180, bottom: 190 }), layout);
    expect(rect).toEqual({ x: frame.x + 200, y: frame.y + 200, w: 1, h: 20 });
  });

  it('is null before the writing has a place', () => {
    expect(caretCanvasRect(viewAt({ left: 0, top: 0, bottom: 0 }, true), layout)).toBeNull();
  });
});
