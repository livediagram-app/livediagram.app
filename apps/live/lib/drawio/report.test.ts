import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { emptyImportImageReport } from '@/lib/import-images';
import type { ImportedPage } from './import';
import { DRAWIO_RULES, drawioOutcome, drawioSceneReport } from './report';
import type { DrawioReport } from './notes';

// docs/specs/020-import-export/drawio-import.md "The import report": draw.io reports through the
// one import report every importer shares (docs/specs/020-import-export/board-scene.md).

const el = (type: string, extra: Record<string, unknown> = {}) =>
  ({
    id: crypto.randomUUID(),
    type,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    ...extra,
  }) as unknown as Element;
const page = (elements: Element[]): ImportedPage => ({ tabId: 't', name: 'Page', elements });
const report = (notes: DrawioReport['notes']): DrawioReport => ({
  pages: 2,
  elements: 6,
  notes,
});

describe('drawioSceneReport', () => {
  it('counts what landed across every page in the shared vocabulary', () => {
    const pages = [
      page([el('shape', { shape: 'square' }), el('shape', { shape: 'frame' }), el('arrow')]),
      page([el('text'), el('sticky'), el('image'), el('freehand'), el('table')]),
    ];
    expect(drawioSceneReport(report([]), pages).landed).toEqual({
      shape: 2,
      frame: 1,
      connector: 1,
      text: 1,
      sticky: 1,
      image: 1,
      polyline: 1,
    });
  });

  it('turns each note into a rule, skips apart from changes, in the spec order', () => {
    const r = drawioSceneReport(
      report([
        { kind: 'shape-approximated', count: 3 },
        { kind: 'hidden-skipped', count: 2 },
        { kind: 'group-flattened', count: 1 },
        { kind: 'content-truncated', count: 4 },
      ]),
      [],
    );
    expect(r.degraded).toEqual([
      { rule: DRAWIO_RULES['shape-approximated'], count: 3 },
      { rule: DRAWIO_RULES['group-flattened'], count: 1 },
    ]);
    expect(r.skipped).toEqual([
      { rule: DRAWIO_RULES['hidden-skipped'], count: 2 },
      { rule: DRAWIO_RULES['content-truncated'], count: 4 },
    ]);
  });

  it('names the unmatched stencils in their rule', () => {
    const r = drawioSceneReport(
      report([
        {
          kind: 'shape-unmatched',
          count: 5,
          names: [
            { name: 'router', count: 3 },
            { name: 'switch', count: 2 },
          ],
          moreNames: 1,
        },
      ]),
      [],
    );
    expect(r.degraded).toEqual([
      { rule: `${DRAWIO_RULES['shape-unmatched']} (router ×3, switch ×2, …)`, count: 5 },
    ]);
  });
});

describe('drawioOutcome', () => {
  it('closes quietly when nothing changed and no images came along', () => {
    expect(drawioOutcome(report([]), [page([el('arrow')])])).toEqual({ status: 'done' });
  });

  it('carries the report when something changed', () => {
    const out = drawioOutcome(report([{ kind: 'label-moved', count: 1 }]), [page([el('text')])]);
    expect(out).toMatchObject({
      status: 'done',
      scene: { landed: { text: 1 }, degraded: [{ rule: DRAWIO_RULES['label-moved'], count: 1 }] },
    });
  });

  it('carries the images report when images came along', () => {
    const images = { ...emptyImportImageReport(), imported: 2 };
    expect(drawioOutcome(report([]), [], images)).toMatchObject({ status: 'done', images });
  });
});
