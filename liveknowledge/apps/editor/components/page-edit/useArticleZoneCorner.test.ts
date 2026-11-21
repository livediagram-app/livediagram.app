import { describe, expect, it } from 'vitest';
import { cornerOf } from './useArticleZoneCorner';

describe('the floating Edit and draft bar', () => {
  const win = { width: 1440, height: 900 };

  it("stands at the document column's right edge", () => {
    expect(cornerOf({ zone: 1120, column: 1000, rail: 1120 }, win)).toEqual({
      right: 440,
      bottom: 24,
    });
  });

  it('never covers a docked rail, whatever the column', () => {
    expect(cornerOf({ zone: 1440, column: 1300, rail: 1120 }, win)).toEqual({
      right: 344,
      bottom: 24,
    });
  });

  it('stands above the footer under the area', () => {
    expect(cornerOf({ zone: 1120, column: 1000, bottom: 852 }, win)).toEqual({
      right: 440,
      bottom: 72,
    });
  });

  it('keeps inside the window with no column yet', () => {
    expect(cornerOf({ zone: 1600 }, win)).toEqual({ right: 24, bottom: 24 });
  });
});
