import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { Element, Tab } from '@livediagram/document';
import { buildTemplate } from './build-template';
import { linkC4Levels } from './c4-levels';

// The C4 levels link to each other (docs/specs/008-canvas/canvas-and-palette.md "Templates").

const tab = (id: string, elements: Element[]): Tab => ({ id, name: id, elements });
const named = (els: Element[], name: string) =>
  els.find(
    (e) =>
      e.type === 'shape' && (e.pageTitle === name || (e.shape === 'boundary' && e.label === name)),
  ) as Extract<Element, { type: 'shape' }>;

describe('linkC4Levels', () => {
  const context = tab('ctx', buildTemplate('c4-context', 0, 0));
  const containers = tab('con', buildTemplate('c4-container', 0, 0));
  const components = tab('cmp', buildTemplate('c4-component', 0, 0));

  it('zooms in from a card to the boundary of the same name, and back out', () => {
    const [ctx, con, cmp] = linkC4Levels([context, containers, components], 'cmp');
    // The landed Component level links back out to the Container level's Order service card, and that card in.
    expect(named(cmp!.elements, 'Order service').link).toEqual({ kind: 'tab', tabId: 'con' });
    const orderCard = con!.elements.find(
      (e) => e.type === 'shape' && e.shape === 'card' && e.pageTitle === 'Order service',
    ) as Extract<Element, { type: 'shape' }>;
    expect(orderCard.link).toEqual({ kind: 'tab', tabId: 'cmp' });
    // The Context level touches neither end of a link with the landed tab, so it is the same object.
    expect(ctx).toBe(context);
  });

  it('links the Context level to the Container level when that one lands', () => {
    const [ctx, con] = linkC4Levels([context, containers], 'con');
    const platform = ctx!.elements.find(
      (e) => e.type === 'shape' && e.shape === 'card' && e.link?.kind === 'tab',
    ) as Extract<Element, { type: 'shape' }>;
    expect(platform.link).toEqual({ kind: 'tab', tabId: 'con' });
    const boundary = con!.elements.find(
      (e) => e.type === 'shape' && e.shape === 'boundary',
    ) as Extract<Element, { type: 'shape' }>;
    expect(boundary.link).toEqual({ kind: 'tab', tabId: 'ctx' });
  });

  it('keeps an existing link, and leaves a document with no C4 boundary as it was', () => {
    const linked = tab(
      'cmp',
      components.elements.map((e) =>
        e.type === 'shape' && e.shape === 'boundary'
          ? { ...e, link: { kind: 'url' as const, url: 'https://example.com' } }
          : e,
      ),
    );
    const [, cmp] = linkC4Levels([containers, linked], 'cmp');
    expect(named(cmp!.elements, 'Order service').link).toEqual({
      kind: 'url',
      url: 'https://example.com',
    });
    const plain = tab('p', []);
    expect(linkC4Levels([plain], 'p')[0]).toBe(plain);
  });

  it('never links a level to its own tab', () => {
    const both = tab('one', [...containers.elements, ...components.elements]);
    const [one] = linkC4Levels([both], 'one');
    expect(one).toBe(both);
  });

  // It runs once per template pick over the whole document: one pass, so a big document stays quick.
  it('links a document of 50 tabs of 1,000 elements within budget', () => {
    const filler = containers.elements.filter((e) => e.type !== 'shape' || e.shape !== 'boundary');
    const big = Array.from({ length: 50 }, (_, i) =>
      tab(`t${i}`, Array.from({ length: 1000 }, (_, j) => filler[j % filler.length]!)),
    );
    const ms = cpuMsOf(() => linkC4Levels([...big, components], 'cmp'));
    expect(ms).toBeLessThan(cpuBudgetMs(150));
  });
});
