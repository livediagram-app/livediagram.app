import { describe, expect, it } from 'vitest';
import { explorerHref, explorerItemHref } from './explorer-href';

describe("the app's Explorer address", () => {
  it('opens each view on this origin, at the same place, with its query', () => {
    expect(explorerHref()).toBe('/explorer');
    expect(explorerHref('trash')).toBe('/explorer/trash');
    expect(explorerHref('/folder/', '?id=f1')).toBe('/explorer/folder?id=f1');
    expect(explorerHref('folder', 'id=f1')).toBe('/explorer/folder?id=f1');
  });

  it('names the open item for the Explorer to open the place that holds it', () => {
    expect(explorerItemHref('d1')).toBe('/explorer?item=d1');
    expect(explorerItemHref('a b/c')).toBe('/explorer?item=a%20b%2Fc');
  });

  it('opens the Explorer as any other door does with no item', () => {
    expect(explorerItemHref()).toBe('/explorer');
    expect(explorerItemHref(null)).toBe('/explorer');
    expect(explorerItemHref('')).toBe('/explorer');
  });
});
