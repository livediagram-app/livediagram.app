// @vitest-environment jsdom

// The Sankey tour's steps (docs/specs/007-editor/element-tours.md "The Sankey tour"): what each points at, which are
// left out, and how a step lifts a part on the canvas or opens the Flows dialog.

import { describe, expect, it, vi } from 'vitest';
import { createShape, sankeyFrame, type ShapeElement } from '@livediagram/document';
import {
  sankeyElementTourSteps,
  sankeyFlowsContextOf,
  sankeyTourParts,
  sankeyTourStepTelemetryType,
  type SankeyElementTourApi,
  type SankeyElementTourContext,
} from './sankey-element-tour-steps';

vi.mock('./tour-dom', () => ({ waitForSelector: async () => null, revealTour: async () => {} }));

const budget = createShape('sankey', 0, 0) as ShapeElement;

const ctxOf = (over: Partial<SankeyElementTourContext> = {}): SankeyElementTourContext => ({
  elementId: 'sk1',
  band: 0,
  node: 1,
  leftover: 4,
  hasMore: true,
  touch: false,
  flows: { hasNodes: true, hasBalanceNotes: true },
  ...over,
});

const api = (): SankeyElementTourApi => ({
  focus: vi.fn(),
  clearFocus: vi.fn(),
  openFlows: vi.fn(),
  closeFlows: vi.fn(),
  showTable: vi.fn(),
  showText: vi.fn(),
});

describe('sankeyElementTourSteps', () => {
  it('reads the diagram, styles it, then runs the Flows dialog and closes', () => {
    expect(sankeyElementTourSteps(ctxOf()).map((s) => s.id)).toEqual([
      'bands',
      'nodes',
      'leftover',
      'style',
      'flows',
      'flows-nodes',
      'flows-rows',
      'flows-add',
      'flows-balance',
      'flows-text',
      'flows-import',
      'flows-preview',
      'outro',
    ]);
  });

  it('leaves out what the diagram does not have', () => {
    const ids = sankeyElementTourSteps(
      ctxOf({
        band: null,
        node: null,
        leftover: null,
        hasMore: false,
        flows: { hasNodes: false, hasBalanceNotes: false },
      }),
    ).map((s) => s.id);
    expect(ids).toEqual([
      'flows',
      'flows-add',
      'flows-text',
      'flows-import',
      'flows-preview',
      'outro',
    ]);
  });

  it('points at the real parts of the toured diagram', () => {
    const steps = sankeyElementTourSteps(ctxOf());
    const a = api();
    const sel = (id: string) => steps.find((s) => s.id === id)!.selector!(a);
    expect(sel('bands')).toBe('[data-element-id="sk1"] [data-sankey-band="0"]');
    expect(sel('nodes')).toBe('[data-element-id="sk1"] [data-sankey-node="1"]');
    expect(sel('leftover')).toBe('[data-element-id="sk1"] [data-sankey-band="4"]');
    expect(sel('style')).toBe('#selection-more-actions');
    expect(sel('flows')).toBe('[data-element-id="sk1"]');
  });

  it('says double-tap on a touch screen', () => {
    const flows = (touch: boolean) =>
      sankeyElementTourSteps(ctxOf({ touch })).find((s) => s.id === 'flows')!.body;
    expect(flows(false)).toMatch(/^Double-click/);
    expect(flows(true)).toMatch(/^Double-tap/);
  });

  it('lifts a part on a canvas step, puts the dialog away, and lets go on leaving', async () => {
    const steps = sankeyElementTourSteps(ctxOf());
    const a = api();
    const bands = steps.find((s) => s.id === 'bands')!;
    await bands.prepare!(a);
    expect(a.closeFlows).toHaveBeenCalled();
    expect(a.focus).toHaveBeenCalledWith('band', 0);
    bands.cleanup!(a);
    expect(a.clearFocus).toHaveBeenCalled();
    const nodes = steps.find((s) => s.id === 'nodes')!;
    await nodes.prepare!(a);
    expect(a.focus).toHaveBeenCalledWith('node', 1);
  });

  it('opens the dialog on its steps, over it, and brings the tab each step is about forward', async () => {
    const steps = sankeyElementTourSteps(ctxOf());
    const a = api();
    const text = steps.find((s) => s.id === 'flows-text')!;
    expect(text.layer).toBe('modal');
    await text.prepare!(a);
    expect(a.openFlows).toHaveBeenCalled();
    expect(a.showText).toHaveBeenCalled();
    text.cleanup!(a);
    expect(a.showTable).toHaveBeenCalled();
    // The canvas steps ring at the stage's own layer.
    expect(steps.find((s) => s.id === 'bands')!.layer).toBeUndefined();
  });

  it('ends on a closing card', () => {
    const outro = sankeyElementTourSteps(ctxOf()).at(-1)!;
    expect(outro.card).toBe('outro');
    expect(outro.title).toBe('That Is a Sankey');
  });

  it('names its telemetry tokens from the step ids', () => {
    expect(sankeyTourStepTelemetryType('bands')).toBe('SankeyTourStepBands');
    expect(sankeyTourStepTelemetryType('flows-add')).toBe('SankeyTourStepFlowsAdd');
  });
});

describe('sankeyTourParts', () => {
  it('picks the widest band and a middle node of the starter budget, and no leftover', () => {
    const parts = sankeyTourParts(budget);
    const { links, nodes } = sankeyFrame(budget).layout;
    const widest = Math.max(...links.map((b) => b.value));
    expect(links[parts.band!]!.value).toBe(widest);
    const node = nodes.find((n) => n.index === parts.node)!;
    expect(node.inflow).toBeGreaterThan(0);
    expect(node.outflow).toBeGreaterThan(0);
    expect(parts.leftover).toBeNull();
  });

  it('finds the widest leftover band when a node keeps some back', () => {
    const el = {
      ...budget,
      sankeyFlows: [
        { from: 'Pay', to: 'Budget', value: 1000 },
        { from: 'Budget', to: 'Rent', value: 600 },
      ],
    } as ShapeElement;
    const parts = sankeyTourParts(el);
    const frame = sankeyFrame(el);
    expect(frame.leftover(frame.layout.links[parts.leftover!]!)).toBe(true);
    expect(frame.leftover(frame.layout.links[parts.band!]!)).toBe(false);
  });

  it('has nothing to lift on an empty diagram', () => {
    expect(sankeyTourParts({ ...budget, sankeyFlows: [] } as ShapeElement)).toEqual({
      band: null,
      node: null,
      leftover: null,
    });
  });
});

describe('sankeyFlowsContextOf', () => {
  it('knows whether the dialog will show nodes and balance notes', () => {
    expect(sankeyFlowsContextOf({ ...budget, sankeyFlows: [] } as ShapeElement)).toEqual({
      hasNodes: false,
      hasBalanceNotes: false,
    });
    const over = {
      ...budget,
      sankeyFlows: [
        { from: 'Pay', to: 'Budget', value: 100 },
        { from: 'Budget', to: 'Rent', value: 150 },
      ],
    } as ShapeElement;
    expect(sankeyFlowsContextOf(over)).toEqual({ hasNodes: true, hasBalanceNotes: true });
  });
});
