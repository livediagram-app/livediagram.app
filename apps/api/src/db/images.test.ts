import { describe, expect, it } from 'vitest';
import { unusedImageIds } from './images';

// unusedImageIds is the pure decision behind the daily unused-image
// sweep (docs/specs/009-elements/images.md "Retention"): given the candidate ids (already
// filtered to "older than the 30-day floor") and every tab body in the
// store, it returns the ids no diagram references — the set safe to
// delete. The R2 + D1 delete loop needs a live binding to test, but
// this is where the "is it actually unused" correctness lives.

const tabWithImages = (...imageIds: (string | null)[]): string =>
  JSON.stringify({
    id: 'tab-1',
    name: 'Tab',
    elements: imageIds.map((imageId, i) => ({
      id: `el-${i}`,
      type: 'image',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      imageId,
    })),
  });

describe('unusedImageIds', () => {
  it('returns every candidate when no tab references any of them', () => {
    const tabs = [tabWithImages('other-1'), tabWithImages('other-2')];
    expect(unusedImageIds(['a', 'b'], tabs).sort()).toEqual(['a', 'b']);
  });

  it('drops a candidate referenced by any tab', () => {
    const tabs = [tabWithImages('a'), tabWithImages('other')];
    expect(unusedImageIds(['a', 'b'], tabs)).toEqual(['b']);
  });

  it('keeps a candidate referenced by a tab from another owner (store-wide scan)', () => {
    // The scan is store-wide on purpose: a shared tab (docs/specs/006-diagram/tab-diagram-many-to-many.md) can
    // place an image inside another owner's diagram. A referenced image
    // is never reaped, whoever's tab it lives in.
    const tabs = [tabWithImages('a')];
    expect(unusedImageIds(['a'], tabs)).toEqual([]);
  });

  it('returns nothing when there are no candidates', () => {
    expect(unusedImageIds([], [tabWithImages('a')])).toEqual([]);
  });

  it('treats an unparseable tab body as no reference (never reaps a referenced image)', () => {
    // A malformed tab can only fail to clear a candidate; it can never
    // remove a real reference, so it errs toward keeping bytes.
    expect(unusedImageIds(['a'], ['{not json', tabWithImages('a')])).toEqual([]);
    expect(unusedImageIds(['a'], ['{not json']).sort()).toEqual(['a']);
  });

  it('ignores image elements with a null imageId (unattached placeholders)', () => {
    expect(unusedImageIds(['a'], [tabWithImages(null)])).toEqual(['a']);
  });

  it('ignores non-image elements that happen to carry an imageId-like field', () => {
    const tab = JSON.stringify({
      id: 'tab-1',
      name: 'Tab',
      elements: [{ id: 'e1', type: 'shape', x: 0, y: 0, width: 1, height: 1, imageId: 'a' }],
    });
    expect(unusedImageIds(['a'], [tab])).toEqual(['a']);
  });
});
