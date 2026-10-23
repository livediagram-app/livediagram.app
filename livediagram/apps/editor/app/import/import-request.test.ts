import { describe, expect, it } from 'vitest';
import { explorerUrl } from '@liveworkspace/sites';
import { importRequestOf, importReturnUrl } from './import-request';

const req = (q: string) => importRequestOf(new URLSearchParams(q));

describe('/import from the liveworkspace Explorer', () => {
  it('reads the source, what and folder', () => {
    expect(req('source=drawio&what=libraries')).toEqual({
      source: 'drawio',
      what: 'libraries',
      folderId: null,
    });
    expect(req('source=excalidraw&folder=f_1')).toEqual({
      source: 'excalidraw',
      what: 'items',
      folderId: 'f_1',
    });
  });

  it('refuses an unknown source and drops a malformed folder', () => {
    expect(req('source=figma')).toBeNull();
    expect(req('')).toBeNull();
    expect(req('source=drawio&folder=../x')?.folderId).toBeNull();
  });

  it('returns to where the imports landed', () => {
    expect(importReturnUrl(req('source=drawio&what=libraries')!)).toBe(
      explorerUrl('livediagram', 'shape-libraries'),
    );
    expect(importReturnUrl(req('source=drawio&folder=f1')!)).toBe(
      explorerUrl('livediagram', 'folder', 'id=f1'),
    );
    expect(importReturnUrl(req('source=drawio')!)).toBe(explorerUrl('livediagram', 'all'));
  });
});
