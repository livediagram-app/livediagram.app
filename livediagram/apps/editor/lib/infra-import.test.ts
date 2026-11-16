import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { INFRA_MAX_FILE_BYTES, INFRA_MAX_NODES } from '@livediagram/document/infra-code';
import { INFRA_FILE_MAX_BYTES, INFRA_REPORT_SUBTITLE, infraImportOutcome } from './infra-import';

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

  it('refuses a picked file at the parsers’ own cap', () => {
    expect(INFRA_FILE_MAX_BYTES).toBe(INFRA_MAX_FILE_BYTES);
  });
});
