import { describe, expect, it } from 'vitest';
import { normalizeReorderEntry } from './tabs';

// normalizeReorderEntry is the pure decision the reorder batch leans
// on (docs/specs/006-diagram/tab-folders.md): it decides what folder value lands on each
// diagram_tabs row. The D1 batch itself needs a live binding to test,
// but this normalisation — legacy-string vs object, and the
// empty-name-to-NULL guard — is where the folder correctness lives.

describe('normalizeReorderEntry', () => {
  it('treats a legacy plain-string entry as loose (folder null)', () => {
    expect(normalizeReorderEntry('tab-1')).toEqual({ id: 'tab-1', folder: null });
  });

  it('keeps a real folder name', () => {
    expect(normalizeReorderEntry({ id: 'tab-1', folder: 'Org' })).toEqual({
      id: 'tab-1',
      folder: 'Org',
    });
  });

  it('trims surrounding whitespace from the folder name', () => {
    expect(normalizeReorderEntry({ id: 'tab-1', folder: '  Org ' }).folder).toBe('Org');
  });

  it('collapses empty / whitespace / null / undefined folder to null (no blank folders persist)', () => {
    expect(normalizeReorderEntry({ id: 'tab-1', folder: '' }).folder).toBeNull();
    expect(normalizeReorderEntry({ id: 'tab-1', folder: '   ' }).folder).toBeNull();
    expect(normalizeReorderEntry({ id: 'tab-1', folder: null }).folder).toBeNull();
    expect(normalizeReorderEntry({ id: 'tab-1' }).folder).toBeNull();
  });
});
