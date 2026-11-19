// @vitest-environment jsdom
// The caps that bound an untrusted .vsdx (docs/specs/020-import-export/visio-import.md "Inputs"), each lowered so
// the guard is reached with a tiny package: entries, part size, parsed elements, inflate budget, picture size.
import { describe, expect, it, vi } from 'vitest';
import { importVisio } from './import';
import { visioRefusalMessage } from './refusals';
import { onePage, shape, vsdx } from './test-support';

vi.mock('./limits', async (original) => ({
  ...(await original<typeof import('./limits')>()),
  VISIO_MAX_ZIP_ENTRIES: 6,
  VISIO_MAX_PART_BYTES: 4000,
  VISIO_MAX_XML_ELEMENTS: 60,
  VISIO_MAX_INFLATED_BYTES: 9000,
  VISIO_MAX_IMAGE_BYTES: 4,
}));

const tabIdForPage = (i: number) => `tab-${i}`;
const BOX = { x: 1, y: 1, w: 1, h: 1 };
const run = (bytes: Uint8Array<ArrayBuffer>) => importVisio(bytes, { tabIdForPage });

describe('caps', () => {
  it('refuses a package listing more entries than the cap', async () => {
    const pages = Array.from({ length: 5 }, () => ({ shapes: '' }));
    expect(await run(vsdx({ pages }))).toEqual({
      ok: false,
      error: visioRefusalMessage('damaged'),
    });
  });

  it('refuses a part larger than the cap before parsing it', async () => {
    const big = shape(1, BOX, { text: 'x'.repeat(5000) });
    expect(await run(onePage(big, undefined, { method: 'stored' }))).toEqual({
      ok: false,
      error: visioRefusalMessage('too-large-unpacked'),
    });
  });

  it('refuses a part with more elements than the cap', async () => {
    const many = Array.from({ length: 10 }, (_, i) => shape(i + 1, BOX)).join('');
    expect(await run(onePage(many))).toEqual({
      ok: false,
      error: visioRefusalMessage('too-large-unpacked'),
    });
  });

  it('refuses a package that inflates past the budget', async () => {
    const pages = [0, 1, 2].map(() => ({ shapes: shape(1, BOX, { text: 'y'.repeat(3500) }) }));
    expect(await run(vsdx({ pages }))).toEqual({
      ok: false,
      error: visioRefusalMessage('too-large-unpacked'),
    });
  });

  it('brings a picture past the size cap in as a placeholder', async () => {
    const foreign = shape(1, BOX, {
      type: 'Foreign',
      inner: '<ForeignData><Rel r:id="rIdA"/></ForeignData>',
    });
    const result = await run(
      vsdx({
        pages: [{ shapes: foreign }],
        media: [{ name: 'big.png', data: 'more than four bytes' }],
        pageRels: { 0: { rIdA: '../media/big.png' } },
      }),
    );
    expect(result.ok && result.images).toEqual([]);
  });
});
