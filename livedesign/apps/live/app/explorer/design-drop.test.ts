import { describe, expect, it } from 'vitest';
import { planDesignDrop } from './design-drop';

const personalRoot = { teamId: null, folderId: null };

describe('planDesignDrop', () => {
  it('moves a design onto another personal folder', () => {
    expect(
      planDesignDrop({
        from: personalRoot,
        to: { teamId: null, folderId: 'f1' },
        localOnly: false,
      }),
    ).toBe('move');
  });

  it('ignores a drop onto the place the design already is', () => {
    expect(
      planDesignDrop({
        from: { teamId: null, folderId: 'f1' },
        to: { teamId: null, folderId: 'f1' },
        localOnly: false,
      }),
    ).toBe('already-there');
    expect(
      planDesignDrop({
        from: { teamId: 't1', folderId: null },
        to: { teamId: 't1', folderId: null },
        localOnly: false,
      }),
    ).toBe('already-there');
  });

  it('moves a design into a team and out of one', () => {
    expect(
      planDesignDrop({
        from: personalRoot,
        to: { teamId: 't1', folderId: 'tf' },
        localOnly: false,
      }),
    ).toBe('move');
    expect(
      planDesignDrop({
        from: { teamId: 't1', folderId: 'tf' },
        to: personalRoot,
        localOnly: false,
      }),
    ).toBe('move');
  });

  it('refuses a team destination for a design that lives only in this browser', () => {
    expect(
      planDesignDrop({
        from: personalRoot,
        to: { teamId: 't1', folderId: null },
        localOnly: true,
      }),
    ).toBe('refused-local-only');
  });

  it('files a design that lives only in this browser into a personal folder', () => {
    expect(
      planDesignDrop({
        from: personalRoot,
        to: { teamId: null, folderId: 'f1' },
        localOnly: true,
      }),
    ).toBe('move');
  });
});
