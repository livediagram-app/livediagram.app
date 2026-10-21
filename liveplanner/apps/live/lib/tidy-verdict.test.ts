import { describe, expect, it } from 'vitest';
import {
  createPinnedArrow,
  createShape,
  type ArrowElement,
  type Element,
  type ShapeElement,
} from '@liveplanner/document';
import { buildTemplate } from '@liveplanner/templates';
import { assessCleanup, cleanupVerdict, verdictLine, verdictNotice } from './tidy-verdict';
import { cleanupElements, type CleanupKind } from './tab-cleanup';

// docs/specs/008-canvas/layout-cleanup.md "A tidy never trashes the work".

const box = (id: string, x: number, y: number, w = 100, h = 50) =>
  ({ ...createShape('square', x, y), id, width: w, height: h }) as ShapeElement;
const arrow = (from: string, to: string): ArrowElement => ({
  ...createPinnedArrow(from, 's', to, 'n'),
  id: `${from}>${to}`,
});
const moved = (els: Element[], id: string, dx: number, dy: number) =>
  els.map((e) =>
    e.id === id
      ? ({ ...e, x: (e as ShapeElement).x + dx, y: (e as ShapeElement).y + dy } as Element)
      : e,
  );

describe('cleanupVerdict', () => {
  const base = [box('a', 0, 0), box('b', 0, 200), box('c', 300, 0), arrow('a', 'b')];

  it('is unchanged when nothing moves', () => {
    expect(cleanupVerdict(base, [...base])).toEqual({ kind: 'unchanged' });
  });

  it('is ok for a move that covers nothing', () => {
    expect(cleanupVerdict(base, moved(base, 'b', 0, 40))).toEqual({ kind: 'ok' });
  });

  it('counts the shapes a move newly covers', () => {
    expect(cleanupVerdict(base, moved(base, 'b', 300, -200))).toEqual({ kind: 'covers', count: 1 });
  });

  it('catches a shape pulled out of the box that held it', () => {
    const els = [box('lane', 0, 0, 400, 100), box('a', 10, 10), box('b', 10, 300), arrow('a', 'b')];
    expect(cleanupVerdict(els, moved(els, 'a', 0, 150))).toEqual({
      kind: 'leaves-container',
      count: 1,
    });
  });

  it('catches lanes strung out of their stack', () => {
    const els = [
      box('lane1', 0, 0, 600, 100),
      box('lane2', 0, 120, 600, 100),
      box('a', 10, 10),
      box('b', 10, 130),
      arrow('a', 'b'),
    ];
    // Both lanes move as blocks (their shapes inside), the second ending up beside the first.
    const after = moved(moved(els, 'lane2', 700, -120), 'b', 700, -120);
    expect(cleanupVerdict(els, after)).toEqual({ kind: 'rearranges-lanes' });
  });
});

describe('assessCleanup on the templates', () => {
  it('judges a mindmap of a looping flowchart unsuited', () => {
    expect(assessCleanup(buildTemplate('flowchart', 600, 400), 'mindmap')).toEqual({
      kind: 'unsuited',
    });
  });

  it('refuses every layout that would string a swimlane out', () => {
    const els = buildTemplate('swimlane', 600, 400);
    expect(assessCleanup(els, 'smart').kind).toBe('rearranges-lanes');
    expect(assessCleanup(els, 'flow-right').kind).toBe('rearranges-lanes');
  });

  // The regression the user reported: on the checkout flowchart, Auto-align leaned the arrows and
  // swelled the decisions, and Flowchart Down threw the flow over the title.
  it('keeps the checkout flowchart intact under Auto-align, Smart and Flowchart Down', () => {
    const els = buildTemplate('flowchart', 600, 400);
    for (const kind of ['align', 'smart', 'flow-down'] as CleanupKind[]) {
      const out = cleanupElements(els, kind);
      expect(cleanupVerdict(els, out).kind, kind).toMatch(/ok|unchanged/);
      const byLabel = (label: string) =>
        out.find((e) => 'label' in e && e.label === label) as ShapeElement;
      const was = (label: string) =>
        els.find((e) => 'label' in e && e.label === label) as ShapeElement;
      // Decisions keep the size they were drawn.
      expect(byLabel('Payment OK?').width, kind).toBe(was('Payment OK?').width);
      expect(byLabel('Payment OK?').height, kind).toBe(was('Payment OK?').height);
      // Every arrow along the spine runs dead straight down, to the first decision: the template is a live
      // flowchart, so its Yes branch steps aside (docs/specs/009-elements/flowchart.md "The layout").
      const spine = ['Checkout', 'Enter card details', 'Charge card', 'Payment OK?'];
      const centres = spine.map((l) => byLabel(l).x + byLabel(l).width / 2);
      expect(new Set(centres).size, kind).toBe(1);
      // Nothing lands on the title.
      const title = out.find((e) => 'label' in e && e.label === 'Checkout flow') as ShapeElement;
      expect(byLabel('Checkout').y, kind).toBeGreaterThan(title.y + title.height);
    }
  });
});

describe('a second press', () => {
  it('finds every tidied template already tidy', () => {
    for (const template of [
      'flowchart',
      'orgchart',
      'decision-tree',
      'approval-workflow',
    ] as const) {
      const els = buildTemplate(template, 600, 400);
      for (const kind of ['align', 'smart'] as CleanupKind[]) {
        const once = cleanupElements(els, kind);
        expect(assessCleanup(once, kind).kind, `${template} ${kind}`).toBe('unchanged');
      }
    }
  });
});

describe('verdict copy', () => {
  it('has a line and a notice for every verdict but ok', () => {
    expect(verdictLine({ kind: 'ok' })).toBeNull();
    expect(verdictNotice('Smart', { kind: 'ok' })).toBeNull();
    expect(verdictLine({ kind: 'covers', count: 1 })).toBe('Would cover a shape');
    expect(verdictLine({ kind: 'covers', count: 3 })).toBe('Would cover 3 shapes');
    expect(verdictNotice('Tree', { kind: 'unchanged' })).toBe(
      'Tree: the tab is already tidy, so nothing moved.',
    );
    for (const v of [
      { kind: 'leaves-container', count: 2 },
      { kind: 'rearranges-lanes' },
      { kind: 'unsuited' },
    ] as const) {
      expect(verdictLine(v)).toBeTruthy();
      expect(verdictNotice('Mindmap', v)).toMatch(/^Mindmap .*nothing moved\.$/);
    }
  });
});
