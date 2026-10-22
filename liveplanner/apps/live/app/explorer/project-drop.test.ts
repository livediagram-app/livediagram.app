import { describe, expect, it } from 'vitest';
import { planProjectDrop } from './project-drop';

const personalRoot = { teamId: null, folderId: null };

describe('planProjectDrop', () => {
  it('moves a project onto another personal folder', () => {
    expect(
      planProjectDrop({
        from: personalRoot,
        to: { teamId: null, folderId: 'f1' },
        localOnly: false,
      }),
    ).toBe('move');
  });

  it('ignores a drop onto the place the project already is', () => {
    expect(
      planProjectDrop({
        from: { teamId: null, folderId: 'f1' },
        to: { teamId: null, folderId: 'f1' },
        localOnly: false,
      }),
    ).toBe('already-there');
    expect(
      planProjectDrop({
        from: { teamId: 't1', folderId: null },
        to: { teamId: 't1', folderId: null },
        localOnly: false,
      }),
    ).toBe('already-there');
  });

  it('moves a project into a team and out of one', () => {
    expect(
      planProjectDrop({
        from: personalRoot,
        to: { teamId: 't1', folderId: 'tf' },
        localOnly: false,
      }),
    ).toBe('move');
    expect(
      planProjectDrop({
        from: { teamId: 't1', folderId: 'tf' },
        to: personalRoot,
        localOnly: false,
      }),
    ).toBe('move');
  });

  it('refuses a team destination for a project that lives only in this browser', () => {
    expect(
      planProjectDrop({
        from: personalRoot,
        to: { teamId: 't1', folderId: null },
        localOnly: true,
      }),
    ).toBe('refused-local-only');
  });

  it('files a project that lives only in this browser into a personal folder', () => {
    expect(
      planProjectDrop({
        from: personalRoot,
        to: { teamId: null, folderId: 'f1' },
        localOnly: true,
      }),
    ).toBe('move');
  });
});
