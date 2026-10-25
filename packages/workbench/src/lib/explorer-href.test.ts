import { describe, expect, it } from 'vitest';
import { explorerHref } from './explorer-href';

describe("the app's Explorer address", () => {
  it('opens each view on this origin, at the same place, with its query', () => {
    expect(explorerHref()).toBe('/explorer');
    expect(explorerHref('trash')).toBe('/explorer/trash');
    expect(explorerHref('/folder/', '?id=f1')).toBe('/explorer/folder?id=f1');
    expect(explorerHref('folder', 'id=f1')).toBe('/explorer/folder?id=f1');
  });
});
