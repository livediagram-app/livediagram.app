import { describe, expect, it } from 'vitest';
import { layOutIllustratePages, type Element } from '@livediagram/document';
import { combinableSelection } from './useCombineShapes';

// docs/specs/007-editor/logo-pages.md "Combine": offered for two or more combinable, unlocked
// elements whose centres are all on one logo page.
describe('combinableSelection', () => {
  const pages = layOutIllustratePages([
    { id: 'l', orientation: 'portrait', size: 'logo', kind: 'logo' },
    { id: 'i', orientation: 'portrait' },
  ]);
  const sq = (id: string, x: number, extra: object = {}): Element =>
    ({ id, type: 'shape', shape: 'square', x, y: 0, width: 50, height: 50, ...extra }) as Element;
  const els = [sq('a', 0), sq('b', 20), sq('c', 2000), sq('d', 30, { locked: true })];

  it('gives the selection in stacking order on one logo page', () => {
    expect(combinableSelection(els, new Set(['b', 'a']), pages)?.map((e) => e.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('is null outside Illustrate, for one element, across pages, or with a locked one', () => {
    expect(combinableSelection(els, new Set(['a', 'b']), null)).toBeNull();
    expect(combinableSelection(els, new Set(['a']), pages)).toBeNull();
    expect(combinableSelection(els, new Set(['a', 'c']), pages)).toBeNull();
    expect(combinableSelection(els, new Set(['a', 'd']), pages)).toBeNull();
  });
});
