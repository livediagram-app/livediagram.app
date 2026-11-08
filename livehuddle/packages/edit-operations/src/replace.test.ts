import { describe, expect, it } from 'vitest';
import {
  applyElementOps,
  getBuiltInTheme,
  type Tab,
  type ThemeDefinition,
} from '@livehuddle/document';
import { formatResultLines } from './format-results';
import { checkoutFlow, fixedIds } from './fixtures/checkout-flow';
import { applied, refused } from './fixtures/outcomes';
import { applyReplace } from './replace';
import type { EditLog, ReplaceBody, ReplaceOptions } from './types';

const options: ReplaceOptions = { tabId: 'new-tab', name: 'Fresh', makeId: fixedIds() };
const arrowBetween = (id: string, from: string, to: string) => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: from, anchor: 's' },
  to: { kind: 'pinned', elementId: to, anchor: 'n' },
});
const square = (id: string, label: string) => ({
  id,
  type: 'shape',
  shape: 'square',
  label,
  x: 0,
  y: 0,
  width: 140,
  height: 60,
});
// Two boxes and the arrow between them, laid out by the engine.
const flow: ReplaceBody = {
  elements: [square('a', 'Start'), square('b', 'Done'), arrowBetween('e1', 'a', 'b')],
  layout: 'auto',
};
const themed = (theme: string): Tab => ({ ...checkoutFlow(), theme, font: 'serif' });

const recording = () => {
  const calls: [string, Record<string, unknown>][] = [];
  const log: EditLog = (fingerprint, fields) => calls.push([fingerprint, { ...fields }]);
  return { calls, log };
};

describe('applyReplace: elements sent back', () => {
  // Fourteen labelled boxes in a column, the first two joined by an arrow with no style: past twelve boxes a new raw
  // box takes `sm` text and a new raw arrow takes angled lines, but these are the tab's own.
  const boxes = Array.from({ length: 14 }, (_, i) => ({
    id: `n${i}`,
    type: 'shape',
    shape: 'square',
    label: `Step ${i}`,
    x: 0,
    y: i * 120,
    width: 140,
    height: 60,
  }));
  const tab = {
    id: 't',
    name: 'T',
    elements: [...boxes, arrowBetween('a1', 'n0', 'n1')],
  } as unknown as Tab;

  it('keeps the look of the elements the tab already holds', () => {
    const { tab: next } = applied(
      applyReplace(tab, { elements: tab.elements, layout: 'preserve' }, options),
    );
    const arrow = next.elements.find((e) => e.id === 'a1')!;
    expect(arrow).not.toHaveProperty('arrowStyle');
    expect(arrow).not.toHaveProperty('curvePoints');
    // Not shrunk to the small size a fresh list of this many boxes takes.
    expect(next.elements.find((e) => e.id === 'n3')).not.toHaveProperty('textSize', 'sm');
  });

  // A stored arrow is a retired element (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part
  // 4): even a new one sent back takes no defaults, kept exactly as sent.
  it('keeps a stored arrow new to the tab exactly as sent', () => {
    const fresh = arrowBetween('a2', 'n2', 'n3');
    const { tab: next } = applied(
      applyReplace(tab, { elements: [...tab.elements, fresh], layout: 'preserve' }, options),
    );
    expect(next.elements.find((e) => e.id === 'a2')).toEqual(fresh);
  });
});

describe('applyReplace on an existing tab', () => {
  it('swaps the elements for laid-out ones, keeping every tab field', () => {
    const tab = themed('ocean');
    const outcome = applyReplace(tab, flow, options);
    const { tab: next, targets, createdIds, results } = applied(outcome);
    expect(next).toMatchObject({
      id: 'main',
      name: 'Checkout flow',
      theme: 'ocean',
      font: 'serif',
    });
    expect(next.elements.map((el) => el.id).sort()).toEqual(expect.arrayContaining(['a', 'b']));
    expect(targets).toEqual([]);
    expect(createdIds).toEqual(next.elements.map((el) => el.id));
    expect(results.filter((line) => line.mark === '+')).toHaveLength(next.elements.length);
    expect(formatResultLines(results)).toContain('- n3  square "Login"');
    expect(results.filter((line) => line.mark === '-')).toHaveLength(tab.elements.length);
  });

  it('round trips through its element ops and their inverse', () => {
    const tab = checkoutFlow();
    const { tab: next, elementOps, inverse } = applied(applyReplace(tab, flow, options));
    expect(applyElementOps(tab.elements, elementOps)).toEqual(next.elements);
    expect(applyElementOps(next.elements, inverse)).toEqual(tab.elements);
  });

  it('builds a template with the tab theme', () => {
    const { tab } = applied(applyReplace(themed('ocean'), { template: 'team-pod' }, options));
    expect(tab.elements.length).toBeGreaterThan(0);
    expect(tab.name).toBe('Checkout flow');
  });

  // The layered layout went with the arrows (part 4): `layout: 'auto'` keeps the positions sent.
  it('takes raw elements, normalised, at the positions sent', () => {
    const elements = [
      { id: 'x', type: 'shape', shape: 'rectangle', x: 0, y: 0, width: 100, height: 50 },
      { id: 'y', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 50 },
      { id: 'z', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 50 },
      arrowBetween('e1', 'x', 'y'),
      arrowBetween('e2', 'y', 'z'),
    ];
    const { tab } = applied(applyReplace(checkoutFlow(), { elements, layout: 'auto' }, options));
    const [x, y] = tab.elements as { shape: string; y: number; textSize?: string }[];
    expect(x!.shape).toBe('square');
    expect(y!.textSize).toBeDefined();
    expect(y!.y).toBe(x!.y);
  });
});

describe('applyReplace for a new tab', () => {
  it('gives the new tab the finish asked for (docs/specs/008-canvas/finish.md)', () => {
    expect(applied(applyReplace(null, flow, { ...options, finish: 'sketch' })).tab.finish).toBe(
      'sketch',
    );
    expect(applied(applyReplace(null, flow, options)).tab.finish).toBeUndefined();
  });

  it('builds a tab with the given id, name and theme', () => {
    const { tab, createdIds } = applied(
      applyReplace(null, flow, { ...options, theme: getBuiltInTheme('ocean') }),
    );
    expect(tab).toMatchObject({ id: 'new-tab', name: 'Fresh', theme: 'ocean' });
    expect(createdIds).toEqual(tab.elements.map((el) => el.id));
  });

  it('names the theme by id, as a new tab takes the document theme', () => {
    const { tab } = applied(
      applyReplace(null, flow, { ...options, themeId: 'ocean', theme: getBuiltInTheme('brand') }),
    );
    expect(tab.theme).toBe('ocean');
  });

  it('builds a template tab whole, with its canvas and kind', () => {
    const { tab } = applied(applyReplace(null, { template: 'virtual-office' }, options));
    expect(tab).toMatchObject({ id: 'new-tab', templateChosen: true, kind: 'diagram' });
  });

  it('builds an elements tab as add_tab does, themed', () => {
    const elements = [
      { id: 'x', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10 },
    ];
    const { tab } = applied(applyReplace(null, { elements }, options));
    expect(tab).toMatchObject({ id: 'new-tab', theme: 'brand' });
  });

  it('logs the source and the element count, and a theme it could not paint', () => {
    const { calls, log } = recording();
    applyReplace(null, flow, {
      ...options,
      log,
      theme: { ...getBuiltInTheme('ocean'), id: 'mine' } as unknown as ThemeDefinition,
    });
    expect(calls).toEqual([
      ['[edit-ops] theme-fallback', {}],
      ['[edit-ops] replace', { source: 'elements', elements: 3 }],
    ]);
  });
});

describe('applyReplace refusals', () => {
  const refusal = (body: unknown) => refused(applyReplace(null, body as ReplaceBody, options));

  it('needs exactly one source', () => {
    expect(refusal({}).details).toEqual(['replace takes exactly one of template, elements']);
    expect(refusal({ ...flow, template: 'team-pod' }).code).toBe('invalid_value');
  });

  // The graph input went with the layout containers (not-in-livehuddle.md "The element engine", part 3): a graph is
  // no source either.
  it('refuses a graph as a body with no source', () => {
    const graph = { nodes: [{ id: 'a', label: 'A' }], edges: [] };
    expect(refusal({ graph }).details).toEqual(['replace takes exactly one of template, elements']);
  });

  // Mermaid is gone from livehuddle (not-in-livehuddle.md "Imports from other tools"): it is no source.
  it('refuses Mermaid as a body with no source', () => {
    expect(refusal({ mermaid: 'flowchart TD\n  a --> b' }).details).toEqual([
      'replace takes exactly one of template, elements',
    ]);
  });

  it('names the templates for an unknown one', () => {
    const rejection = refusal({ template: 'nope' });
    expect(rejection.details).toEqual(['template="nope": not a template']);
    expect(rejection.hint).toContain('all-hands-hall');
    expect(refusal({ template: 7 }).code).toBe('invalid_value');
  });

  it('refuses elements that are not a list, or an element the format does not allow', () => {
    expect(refusal({ elements: 'x' }).details).toEqual(['elements: expected an array of elements']);
    expect(refusal({ elements: [{ id: 'x', type: 'sticky' }] }).details).toEqual([
      'x x: a finite number',
    ]);
    expect(refusal({ elements: [{ type: 'blob' }] }).details).toEqual([
      'an element id: a non-empty string',
    ]);
    expect(refusal({ elements: [{ id: 'q', type: 7 }] }).hint).toBe(
      'see the format: livehuddle schema',
    );
  });

  it('refuses two elements with one id', () => {
    const el = { id: 'x', type: 'sticky', x: 0, y: 0, width: 10, height: 10 };
    expect(refusal({ elements: [el, el] }).details).toEqual(['the tab elements: every id once']);
  });

  it('logs a refusal', () => {
    const { calls, log } = recording();
    applyReplace(null, {} as ReplaceBody, { ...options, log });
    expect(calls).toEqual([
      ['[edit-ops] rejected', { code: 'invalid_value', operation: 0, op: 'replace' }],
    ]);
  });
});
