import { describe, expect, it } from 'vitest';
import { cornerOf } from './useArticleZoneCorner';

describe('the floating Edit and draft bar', () => {
  const win = { width: 1440, height: 900 };

  it("stands inside the document area's bottom right corner", () => {
    expect(cornerOf({ zone: 1120, bottom: 852 }, win)).toEqual({ right: 344, bottom: 72 });
  });

  it('never covers a docked rail', () => {
    expect(cornerOf({ zone: 1440, rail: 1120 }, win)).toEqual({ right: 344, bottom: 24 });
  });

  it('keeps inside the window', () => {
    expect(cornerOf({ zone: 1600, bottom: 1000 }, win)).toEqual({ right: 24, bottom: 24 });
  });
});
