import { describe, expect, it } from 'vitest';
import type { Element, ThemeDefinition } from '@livehuddle/document';
import { buildDressedDrawnArrow } from './draw-commit';
import { drawnArrowAsShown } from './drawn-arrow-preview';

// docs/specs/023-draw-mode/draw-mode.md "Shapes": the preview is the arrow the release lands, as
// the canvas shows it (Draw mode's Ink, by name, in its version for the canvas).

const theme = { elementStroke: '#123456' } as unknown as ThemeDefinition;
const dress = <T extends Element>(el: T): T => ({ ...el, strokeWidth: 4 });

describe('drawnArrowAsShown', () => {
  it('is the committed arrow, as it lands, in the theme stroke', () => {
    const intent = { type: 'arrow', ends: 'to' } as const;
    const shown = drawnArrowAsShown(intent, 0, 0, 200, 50, {
      elements: [],
      theme,
      styleNewElement: dress,
      surface: 'dark',
    });
    const landed = buildDressedDrawnArrow(intent, 0, 0, 200, 50, { elements: [], theme }, dress);
    expect({ ...shown, id: 'x' }).toEqual({ ...landed, id: 'x' });
  });

  it('leaves an arrow in the theme stroke', () => {
    const shown = drawnArrowAsShown({ type: 'arrow' }, 0, 0, 200, 50, {
      elements: [],
      theme,
      styleNewElement: dress,
      surface: 'light',
    });
    expect(shown.strokeColor).toBe('#123456');
    expect(shown.strokeWidth).toBe(4);
  });

  it('keeps one id across the drag, so its markers and mask stay put', () => {
    const shown = drawnArrowAsShown({ type: 'arrow' }, 0, 0, 200, 50, {
      elements: [],
      theme,
      styleNewElement: dress,
      surface: 'light',
    });
    expect(shown.id).toBe('drawn-arrow-preview');
  });
});
