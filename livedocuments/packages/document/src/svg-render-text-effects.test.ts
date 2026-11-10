import { describe, expect, it } from 'vitest';
import { boxedNeedsSvgRaster } from './svg-render';
import { createText } from './factories';

// The shared emitters' own tests live beside them in @liveworkspace/element-model/svg-render-text-effects.
describe('text effects in exports (docs/specs/008-canvas/text-effects.md "Rendering")', () => {
  it('sends a label with an effect through the SVG for a PNG, and a plain one not', () => {
    const text = createText(0, 0);
    expect(boxedNeedsSvgRaster({ ...text, richText: [{ text: 'a' }] })).toBe(false);
    expect(boxedNeedsSvgRaster({ ...text, richText: [{ text: 'a', gradient: 'ocean' }] })).toBe(
      true,
    );
  });
});
