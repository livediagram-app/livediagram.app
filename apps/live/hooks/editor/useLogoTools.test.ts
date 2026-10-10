import { describe, expect, it } from 'vitest';
import { layOutIllustratePages, newLogoPage, type Element } from '@livediagram/document';
import { mirrorCopies } from './useLogoTools';

// docs/specs/007-editor/logo-pages.md "Mirror": Mirror Copy reflects fresh copies.
describe('mirrorCopies', () => {
  const pages = layOutIllustratePages([newLogoPage('l')]);
  const els: Element[] = [
    { id: 's', type: 'shape', shape: 'circle', x: -300, y: 0, width: 100, height: 100, note: 'n' },
    { id: 't', type: 'text', x: -300, y: 200, width: 100, height: 20, label: 'Hi' },
    { id: 'axis', type: 'shape', shape: 'square', x: -50, y: 0, width: 100, height: 100 },
    { id: 'off', type: 'shape', shape: 'square', x: 5000, y: 0, width: 10, height: 10 },
  ] as Element[];

  it('reflects each selected element on a logo page, as a fresh copy', () => {
    const twins = mirrorCopies(els, new Set(['s', 't', 'axis', 'off']), pages);
    expect(twins).toHaveLength(2);
    expect(twins.map((t) => t.x)).toEqual([200, 200]);
    expect(twins.every((t) => !['s', 't'].includes(t.id))).toBe(true);
  });

  it('gives nothing when nothing selected can be reflected', () => {
    expect(mirrorCopies(els, new Set(['axis', 'off']), pages)).toEqual([]);
  });
});
