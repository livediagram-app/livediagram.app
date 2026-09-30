import { describe, expect, it } from 'vitest';
import { createShape, defaultScheme, type Element } from '@livediagram/document';
import { quickStyleView } from './quick-style';
import { onWhiteboard } from './quick-style-whiteboard';

// docs/specs/023-whiteboard/whiteboard.md "The quick style panel stays": on a whiteboard the panel's
// "theme default" swatches show what an unpainted element looks like there,
// the board's ink with no fill, not the diagram defaults.
const INK = '#1c1917';
const shape = { ...createShape('square', 0, 0), fillColor: 'transparent' } as Element;

describe('onWhiteboard', () => {
  it('shows the ink for the outline and text defaults, and no fill for the background default', () => {
    const view = onWhiteboard(quickStyleView([shape], defaultScheme('light')), [shape], INK)!;
    expect(view.sections.stroke!.swatches[0]!.color).toBe(INK);
    expect(view.sections.background!.swatches[0]!.color).toBe('transparent');
  });

  it('reads an unfilled whiteboard shape as the background default', () => {
    const view = onWhiteboard(quickStyleView([shape], defaultScheme('light')), [shape], INK)!;
    expect(view.sections.background!.value).toBe(0);
  });

  it('leaves a fill nobody can match as no selection', () => {
    const odd = { ...shape, fillColor: '#123456' } as Element;
    const view = onWhiteboard(quickStyleView([odd], defaultScheme('light')), [odd], INK)!;
    expect(view.sections.background!.value).toBeNull();
  });

  it('passes a missing view through', () => {
    expect(onWhiteboard(null, [], INK)).toBeNull();
  });
});
