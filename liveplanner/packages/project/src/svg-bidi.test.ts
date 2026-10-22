import { describe, expect, it } from 'vitest';
import { bidiLine, bidiMarkup, hasRtl } from './svg-bidi';
import { svgWrappedLabel } from './svg-render-labels';

// docs/specs/008-canvas/canvas-and-palette.md "Labels": an exported line of right-to-left text takes its own
// direction, as on the canvas; any other line is left exactly as it was.
describe('right-to-left lines in exports', () => {
  it('isolates a line that holds Arabic or Hebrew, and nothing else', () => {
    expect(hasRtl('مرحبا بالعالم!')).toBe(true);
    expect(hasRtl('שלום, עולם.')).toBe(true);
    expect(hasRtl('Hello, world! 123')).toBe(false);
    expect(bidiLine('ما هذا؟')).toBe('⁨ما هذا؟⁩');
    expect(bidiLine('Hello')).toBe('Hello');
    expect(bidiMarkup('<tspan>שלום</tspan>', 'שלום')).toBe('⁨<tspan>שלום</tspan>⁩');
    expect(bidiMarkup('<tspan>Hi</tspan>', 'Hi')).toBe('<tspan>Hi</tspan>');
  });

  it('wraps only the right-to-left lines of an exported label', () => {
    const svg = svgWrappedLabel(['مرحبا!', 'Hello!'], 50, 50, 'middle', '#000', 14, false, false);
    expect(svg).toContain('>⁨مرحبا!⁩</tspan>');
    expect(svg).toContain('>Hello!</tspan>');
  });
});
