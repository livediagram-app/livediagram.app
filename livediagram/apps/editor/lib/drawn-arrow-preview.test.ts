import { describe, expect, it } from 'vitest';
import type { Element, ThemeDefinition } from '@livediagram/document';
import { PEN_INK } from '@livediagram/document';
import { buildDressedDrawnArrow } from './draw-commit';
import { drawnArrowAsShown } from './drawn-arrow-preview';

// docs/specs/023-draw-mode/draw-mode.md "Shapes": the preview is the arrow the release lands, as
// the canvas shows it (Draw mode's Ink, by name, in its version for the canvas).

const theme = { elementStroke: '#123456' } as unknown as ThemeDefinition;
const dress = <T extends Element>(el: T): T => ({ ...el, strokeWidth: 4 });

describe('drawnArrowAsShown', () => {
  it('is the committed arrow, its Ink drawn for the canvas', () => {
    const intent = { type: 'arrow', ends: 'to', board: true } as const;
    const shown = drawnArrowAsShown(intent, 0, 0, 200, 50, {
      elements: [],
      theme,
      whiteboard: true,
      styleNewElement: dress,
      surface: 'dark',
    });
    const landed = buildDressedDrawnArrow(
      intent,
      0,
      0,
      200,
      50,
      { elements: [], theme, whiteboard: true },
      dress,
    );
    expect({ ...shown, id: 'x' }).toEqual({ ...landed, strokeColor: PEN_INK.dark, id: 'x' });
    expect(shown.strokeWidth).toBe(4);
  });

  it('leaves a diagram arrow as it lands, in the theme stroke', () => {
    const shown = drawnArrowAsShown({ type: 'arrow' }, 0, 0, 200, 50, {
      elements: [],
      theme,
      whiteboard: false,
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
      whiteboard: false,
      styleNewElement: dress,
      surface: 'light',
    });
    expect(shown.id).toBe('drawn-arrow-preview');
  });
});
