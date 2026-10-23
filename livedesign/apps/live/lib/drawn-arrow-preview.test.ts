import { describe, expect, it } from 'vitest';
import type { Element, ThemeDefinition } from '@livedesign/design';
import { buildDressedDrawnArrow } from './draw-commit';
import { drawnArrowAsShown } from './drawn-arrow-preview';

// The preview is the arrow the release lands, as the canvas shows it.

const theme = { elementStroke: '#123456' } as unknown as ThemeDefinition;
const dress = <T extends Element>(el: T): T => ({ ...el, strokeWidth: 4 });

describe('drawnArrowAsShown', () => {
  it('is the committed arrow, in the theme stroke', () => {
    const intent = { type: 'arrow', ends: 'to' } as const;
    const shown = drawnArrowAsShown(intent, 0, 0, 200, 50, {
      elements: [],
      theme,
      styleNewElement: dress,
      surface: 'light',
    });
    const landed = buildDressedDrawnArrow(intent, 0, 0, 200, 50, { elements: [], theme }, dress);
    expect({ ...shown, id: 'x' }).toEqual({ ...landed, id: 'x' });
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
