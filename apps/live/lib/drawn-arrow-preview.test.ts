import { describe, expect, it } from 'vitest';
import type { Element, ThemeDefinition } from '@livediagram/document';
import { inkWhiteboardElement } from '@livediagram/document';
import { buildDressedDrawnArrow } from './draw-commit';
import { drawnArrowAsShown } from './drawn-arrow-preview';

// docs/specs/023-whiteboard/whiteboard.md "Shapes": the preview is the arrow the release lands, as
// the canvas shows it (a whiteboard's unpainted line in the viewer's ink).

const theme = { elementStroke: '#123456' } as unknown as ThemeDefinition;
const dress = <T extends Element>(el: T): T => ({ ...el, strokeWidth: 4 });

describe('drawnArrowAsShown', () => {
  it('is the committed arrow in the whiteboard ink', () => {
    const intent = { type: 'arrow', ends: 'to', board: true } as const;
    const shown = drawnArrowAsShown(intent, 0, 0, 200, 50, {
      elements: [],
      theme,
      whiteboard: true,
      styleNewElement: dress,
      ink: '#fafaf9',
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
    expect({ ...shown, id: 'x' }).toEqual({
      ...inkWhiteboardElement(landed, '#fafaf9'),
      id: 'x',
    });
    expect(shown.strokeWidth).toBe(4);
  });

  it('leaves a diagram arrow as it lands, in the theme stroke', () => {
    const shown = drawnArrowAsShown({ type: 'arrow' }, 0, 0, 200, 50, {
      elements: [],
      theme,
      whiteboard: false,
      styleNewElement: dress,
      ink: '#fafaf9',
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
      ink: '#fafaf9',
    });
    expect(shown.id).toBe('drawn-arrow-preview');
  });
});
