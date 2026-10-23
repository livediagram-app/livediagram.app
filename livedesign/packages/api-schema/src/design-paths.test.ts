import { describe, expect, it } from 'vitest';
import { designPath } from './design-paths';

describe('designPath', () => {
  it("is the design's page in the editor, its id encoded", () => {
    expect(designPath('abc-123')).toBe('/design/abc-123');
    expect(designPath('a/b c')).toBe('/design/a%2Fb%20c');
  });
});
