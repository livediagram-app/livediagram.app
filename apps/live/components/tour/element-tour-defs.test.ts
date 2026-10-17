// The element tour registry (docs/specs/007-editor/element-tours.md "Adding an element tour"): every toured kind has
// a definition, a token of its own, and steps that end on a closing card.

import { describe, expect, it, vi } from 'vitest';
import {
  applyShapeVariant,
  createShape,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import { ELEMENT_TOUR_KINDS } from '@/lib/element-tours';
import { ELEMENT_TOUR_DEFS, elementTourStepTelemetryType } from './element-tour-defs';
import type { ElementTourApi } from './element-tour-api';

const SAMPLE: Record<(typeof ELEMENT_TOUR_KINDS)[number], Element> = {
  sankey: createShape('sankey', 0, 0),
  'layer-stack': createShape('layer-stack', 0, 0),
  pyramid: createShape('pyramid', 0, 0),
  funnel: applyShapeVariant(createShape('pyramid', 0, 0), 'funnel'),
  cycle: createShape('cycle', 0, 0),
  hub: createShape('hub', 0, 0),
  onion: createShape('onion', 0, 0),
  chevrons: createShape('chevrons', 0, 0),
  'mind-node': createShape('mind-node', 0, 0),
  flowchart: { ...createShape('square', 0, 0), flowchartId: 'f1' },
  'org-chart': {
    ...createShape('mind-node', 0, 0),
    mindLook: 'person',
    label: 'Ana Kim',
  },
  sequence: createShape('sequence', 0, 0),
  chart: createShape('line-chart', 0, 0),
  stack: createShape('stack', 0, 0),
  entity: createShape('entity', 0, 0),
  'tab-window': createShape('tab-window', 0, 0),
  lane: createShape('lane', 0, 0),
  boundary: createShape('boundary', 0, 0),
  'diagram-key': createShape('diagram-key', 0, 0),
  portal: createShape('portal', 0, 0),
};

describe('ELEMENT_TOUR_DEFS', () => {
  it('defines every toured kind, each with its own token', () => {
    expect(Object.keys(ELEMENT_TOUR_DEFS).sort()).toEqual([...ELEMENT_TOUR_KINDS].sort());
    const tokens = Object.values(ELEMENT_TOUR_DEFS).map((d) => d.token);
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const t of tokens) expect(t).toMatch(/^[A-Z][A-Za-z]+Tour$/);
  });

  it.each(ELEMENT_TOUR_KINDS)(
    'gives the %s tour steps on its element, ending on a closing card',
    (kind) => {
      const steps = ELEMENT_TOUR_DEFS[kind].steps(SAMPLE[kind], {
        hasMore: true,
        touch: false,
        elements: [SAMPLE[kind]],
      });
      expect(steps.length).toBeGreaterThan(2);
      expect(steps.at(-1)?.card).toBe('outro');
      expect(steps.filter((s) => s.card === 'welcome')).toEqual([]);
    },
  );

  it('puts away the Sequence dialog on Done', () => {
    const api = { closeSequence: vi.fn() } as unknown as ElementTourApi;
    ELEMENT_TOUR_DEFS.sequence.onDone?.(api);
    expect(api.closeSequence).toHaveBeenCalled();
  });

  it('puts away the Chart Data dialog on Done', () => {
    const api = { closeChartData: vi.fn() } as unknown as ElementTourApi;
    ELEMENT_TOUR_DEFS.chart.onDone?.(api);
    expect(api.closeChartData).toHaveBeenCalled();
  });

  it('reads past its element where a tour needs to: a stack its first child', () => {
    const stack = { ...createShape('stack', 0, 0), width: 400, height: 200 } as Element;
    const kid = { ...createShape('square', 40, 40), width: 80, height: 80 } as Element;
    const steps = ELEMENT_TOUR_DEFS.stack.steps(stack, {
      hasMore: true,
      touch: false,
      elements: [stack, kid],
    });
    expect(steps.map((s) => s.id)).toContain('child');
    expect(
      ELEMENT_TOUR_DEFS.stack
        .steps(stack, { hasMore: true, touch: false, elements: [stack] })
        .map((s) => s.id),
    ).toContain('drop');
  });

  it('reads a chart as its own type, and a sheet chart as having no data of its own', () => {
    const pie = createShape('pie-chart', 0, 0) as Element;
    const env = { hasMore: true, touch: false, elements: [pie] };
    expect(ELEMENT_TOUR_DEFS.chart.steps(pie, env)[0]!.body).toContain('Pie chart');
    const line = createShape('line-chart', 0, 0);
    expect(ELEMENT_TOUR_DEFS.chart.steps(line, env).map((s) => s.id)).toContain('data');
    const fromSheet: ShapeElement = {
      ...line,
      chartSource: { sheetId: 's', range: { r1: 'a', c1: 'a', r2: 'b', c2: 'b' } },
    };
    expect(ELEMENT_TOUR_DEFS.chart.steps(fromSheet, env).map((s) => s.id)).not.toContain('data');
  });

  it('puts away the Sankey Flows dialog on Done', () => {
    const api = { closeFlows: vi.fn() } as unknown as ElementTourApi;
    ELEMENT_TOUR_DEFS.sankey.onDone?.(api);
    expect(api.closeFlows).toHaveBeenCalled();
  });

  it('names step views from the token', () => {
    expect(elementTourStepTelemetryType(ELEMENT_TOUR_DEFS.sankey, 'flows-add')).toBe(
      'SankeyTourStepFlowsAdd',
    );
    expect(elementTourStepTelemetryType(ELEMENT_TOUR_DEFS['layer-stack'], 'animate')).toBe(
      'LayerStackTourStepAnimate',
    );
  });
});
