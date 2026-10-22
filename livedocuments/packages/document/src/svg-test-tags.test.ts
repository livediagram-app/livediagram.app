import { describe, expect, it } from 'vitest';
import { svgTags, textTagBefore } from './svg-test-tags';

describe('svgTags', () => {
  it('reads each tag of a name, and only that name', () => {
    const svg =
      '<svg viewBox="0 0 24 24" stroke-width="2"><rect width="1" height="2"/><rectx a="1"/></svg>';
    expect(svgTags(svg, 'rect')).toEqual([{ width: '1', height: '2' }]);
    expect(svgTags(svg, 'svg')[0]!['stroke-width']).toBe('2');
  });
});

describe('textTagBefore', () => {
  it('finds the text tag that opens the words, through a tspan', () => {
    const svg = '<text x="1" y="9"><tspan x="1">Change Events</tspan></text>';
    expect(textTagBefore(svg, 'Change Events')?.y).toBe('9');
    expect(textTagBefore(svg, 'absent')).toBeNull();
  });
});
