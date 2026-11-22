import { describe, expect, it } from 'vitest';
import { BRIEF_VALUES_MAX, elementFormatPointer, styleFieldsBrief } from './element-brief';

// Each product's docs/specs/015-api/mcp-server.md §4.18 "The element format, once".

describe('the element format in brief', () => {
  it('lists a short closed field with its values and names a long one alone', () => {
    const long = Array.from({ length: BRIEF_VALUES_MAX + 1 }, (_, i) => `v${i}`);
    const text = styleFieldsBrief({ textAlignX: ['left', 'center', 'right'], font: long });
    expect(text).toContain('"textAlignX" (left, center, right)');
    expect(text).toContain('"font"; ');
    expect(text).not.toContain('v0');
  });

  it('says where the rest of the format is, and that a wrong value is refused naming what it takes', () => {
    const text = elementFormatPointer('livediagram://schema/elements');
    expect(text).toContain('livediagram://schema/elements');
    expect(text).toContain('refused naming what it takes');
  });
});
