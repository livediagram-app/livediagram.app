import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { INFRA_MAX_FILE_BYTES, INFRA_MAX_NODES } from '@livediagram/document/infra-code';
import {
  INFRA_FILE_ACCEPT,
  INFRA_FILE_MAX_BYTES,
  INFRA_REPORT_SUBTITLE,
  infraImportOutcome,
  infraUpdateOffered,
  infraUpdateOutcome,
} from './infra-import';

const box = (id: string, shape = 'square') => ({ id, type: 'shape', shape }) as unknown as Element;
const arrow = (id: string) => ({ id, type: 'arrow' }) as unknown as Element;
const text = (id: string) => ({ id, type: 'text' }) as unknown as Element;

const none = {
  skippedLine: '',
  skippedKeys: 0,
  leftOut: 0,
  maxNodes: INFRA_MAX_NODES,
  linesLeftOut: 0,
  linesKept: 0,
};

describe('infraImportOutcome', () => {
  it('closes the dialog when nothing was skipped or left out', () => {
    expect(infraImportOutcome([box('a')], none)).toEqual({ status: 'done' });
  });

  it('reports skipped keys, boxes past the cap and lines past the limit, one line each', () => {
    const outcome = infraImportOutcome(
      [box('a'), box('b'), box('g', 'frame'), arrow('e'), text('title')],
      {
        ...none,
        skippedLine: 'vars, observability (2)',
        skippedKeys: 2,
        leftOut: 51,
        linesLeftOut: 35,
        linesKept: 1000,
      },
    );
    expect(outcome).toEqual({
      status: 'done',
      subtitle: INFRA_REPORT_SUBTITLE,
      scene: {
        landed: { shape: 2, connector: 1, frame: 1 },
        degraded: [],
        skipped: [
          { rule: 'Keys not drawn: vars, observability (2)', count: 2 },
          { rule: 'Boxes left out past the first 149, listed in the last box', count: 51 },
          { rule: 'Lines left out past the first 1,000', count: 35 },
        ],
      },
    });
  });

  it('leaves frames out of what landed when there are none', () => {
    const outcome = infraImportOutcome([box('a')], {
      ...none,
      skippedLine: 'vars',
      skippedKeys: 1,
    });
    expect(outcome).toMatchObject({ scene: { landed: { shape: 1, connector: 0 } } });
  });

  it('refuses a picked file at the parsers’ own cap, and offers .tf files', () => {
    expect(INFRA_FILE_MAX_BYTES).toBe(INFRA_MAX_FILE_BYTES);
    expect(INFRA_FILE_ACCEPT.split(',')).toEqual(
      expect.arrayContaining(['.toml', '.yml', '.yaml', '.tf']),
    );
  });
});

describe('infraUpdateOutcome', () => {
  const counts = { added: 0, removed: 0, kept: 0, editsKept: 0, linesAdded: 0, linesRemoved: 0 };

  it('always reports, titled Update complete, each count above 0 a line', () => {
    expect(
      infraUpdateOutcome(
        [box('a'), arrow('e')],
        2,
        { ...counts, added: 1, kept: 4, editsKept: 2, linesRemoved: 3 },
        {
          skippedLine: 'vars',
          skippedKeys: 1,
        },
      ),
    ).toEqual({
      status: 'done',
      title: 'Update complete',
      subtitle: 'Updated from 2 files.',
      scene: {
        landed: { shape: 1, connector: 1 },
        degraded: [
          { rule: 'Boxes added from the files', count: 1 },
          { rule: 'Lines removed', count: 3 },
          { rule: 'Boxes kept where they were', count: 4 },
          { rule: 'Edits kept (labels, notes or icons changed on the tab)', count: 2 },
        ],
        skipped: [{ rule: 'Keys not drawn: vars', count: 1 }],
      },
    });
    const one = infraUpdateOutcome(
      [],
      1,
      { ...counts, removed: 1, linesAdded: 2 },
      {
        skippedLine: '',
        skippedKeys: 0,
      },
    );
    expect(one).toMatchObject({
      subtitle: 'Updated from 1 file.',
      scene: {
        degraded: [
          { rule: 'Boxes removed, gone from the files', count: 1 },
          { rule: 'Lines added', count: 2 },
        ],
        skipped: [],
      },
    });
  });
});

// Share roles (infrastructure-import.md "Share roles"): only an Editor updates a tab from its files, and never a locked
// one; a tab no file drew has nothing to update from.
describe('infraUpdateOffered', () => {
  const sources = { bridge: 'infra' as const, files: [], readAt: 1, nodes: {}, edges: {} };

  it('offers the update to an Editor on an unlocked tab the import drew', () => {
    expect(infraUpdateOffered({ sources }, 'edit')).toBe(true);
  });

  it('never to a Participant or a Viewer', () => {
    expect(infraUpdateOffered({ sources }, 'participate')).toBe(false);
    expect(infraUpdateOffered({ sources }, 'view')).toBe(false);
  });

  it('not on a locked tab, nor one with no sound record', () => {
    expect(infraUpdateOffered({ sources, locked: true }, 'edit')).toBe(false);
    expect(infraUpdateOffered({}, 'edit')).toBe(false);
    expect(
      infraUpdateOffered({ sources: { bridge: 'x' } as unknown as typeof sources }, 'edit'),
    ).toBe(false);
  });
});
