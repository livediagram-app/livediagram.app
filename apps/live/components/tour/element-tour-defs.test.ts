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
  sankey: createShape('sankey', 0, 0) as Element,
  'layer-stack': createShape('layer-stack', 0, 0) as Element,
  pyramid: createShape('pyramid', 0, 0) as Element,
  funnel: applyShapeVariant(createShape('pyramid', 0, 0) as ShapeElement, 'funnel') as Element,
  cycle: createShape('cycle', 0, 0) as Element,
  hub: createShape('hub', 0, 0) as Element,
  onion: createShape('onion', 0, 0) as Element,
  chevrons: createShape('chevrons', 0, 0) as Element,
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
      const steps = ELEMENT_TOUR_DEFS[kind].steps(SAMPLE[kind], { hasMore: true, touch: false });
      expect(steps.length).toBeGreaterThan(2);
      expect(steps.at(-1)?.card).toBe('outro');
      expect(steps.filter((s) => s.card === 'welcome')).toEqual([]);
    },
  );

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
