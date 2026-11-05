import { describe, expect, it } from 'vitest';
import { importRequestOf, importReturnUrl } from './import-request';

const req = (q: string) => importRequestOf(new URLSearchParams(q));

describe('/import from the Explorer', () => {
  it('reads the source and folder', () => {
    expect(req('source=excalidraw&folder=f_1')).toEqual({
      source: 'excalidraw',
      folderId: 'f_1',
    });
    // A library import is gone with Shape Libraries (Work Tracker #423, part 4): `what` is not read.
    expect(req('source=excalidraw&what=libraries')).toEqual({
      source: 'excalidraw',
      folderId: null,
    });
  });

  it('refuses an unknown source and drops a malformed folder', () => {
    expect(req('source=figma')).toBeNull();
    expect(req('')).toBeNull();
    expect(req('source=excalidraw&folder=../x')?.folderId).toBeNull();
  });

  // The draw.io and Microsoft Whiteboard imports left livehuddle (Work Tracker #423, part 4).
  it('treats a retired source as unknown', () => {
    expect(req('source=drawio')).toBeNull();
    expect(req('source=microsoft-whiteboard')).toBeNull();
  });

  it('returns to where the imports landed', () => {
    expect(importReturnUrl(req('source=excalidraw&folder=f1')!)).toBe('/explorer/folder?id=f1');
    expect(importReturnUrl(req('source=excalidraw')!)).toBe('/explorer/all');
  });
});
