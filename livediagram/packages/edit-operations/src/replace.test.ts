import { describe, expect, it } from 'vitest';
import {
  applyElementOps,
  getBuiltInTheme,
  type Tab,
  type ThemeDefinition,
} from '@livediagram/document';
import { formatResultLines } from './format-results';
import { checkoutFlow, fixedIds } from './fixtures/checkout-flow';
import { applied, refused } from './fixtures/outcomes';
import { applyReplace } from './replace';
import type { EditLog, ReplaceBody, ReplaceOptions } from './types';

const graph = {
  nodes: [
    { id: 'a', label: 'Start' },
    { id: 'b', label: 'Done' },
  ],
  edges: [{ from: 'a', to: 'b' }],
};
const options: ReplaceOptions = { tabId: 'new-tab', name: 'Fresh', makeId: fixedIds() };
const arrowBetween = (id: string, from: string, to: string) => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: from, anchor: 's' },
  to: { kind: 'pinned', elementId: to, anchor: 'n' },
});
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

  it('gives an element new to the tab the raw defaults', () => {
    const fresh = arrowBetween('a2', 'n2', 'n3');
    const { tab: next } = applied(
      applyReplace(tab, { elements: [...tab.elements, fresh], layout: 'preserve' }, options),
    );
    expect(next.elements.find((e) => e.id === 'a2')).toHaveProperty('arrowStyle');
  });
});

describe('applyReplace on an existing tab', () => {
  it('swaps the elements for a laid-out graph, keeping every tab field', () => {
    const tab = themed('ocean');
    const outcome = applyReplace(tab, { graph }, options);
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

  it("keeps a graph's tones: the presets resolve with the tab's theme, as on a new tab", () => {
    const toned = {
      nodes: [
        { id: 'go', label: 'Go', shape: 'stadium', tone: 'strong' as const },
        { id: 'end', label: 'Stop', shape: 'stadium' },
      ],
      edges: [{ from: 'go', to: 'end' }],
    };
    const { tab: next } = applied(applyReplace(themed('ocean'), { graph: toned }, options));
    const go = next.elements.find((el) => el.id === 'go') as { fillColor?: string };
    const end = next.elements.find((el) => el.id === 'end') as { fillColor?: string };
    expect(go.fillColor).toBeDefined();
    expect(go.fillColor).not.toBe(end.fillColor);
  });

  it('round trips through its element ops and their inverse', () => {
    const tab = checkoutFlow();
    const { tab: next, elementOps, inverse } = applied(applyReplace(tab, { graph }, options));
    expect(applyElementOps(tab.elements, elementOps)).toEqual(next.elements);
    expect(applyElementOps(next.elements, inverse)).toEqual(tab.elements);
  });

  it('takes Mermaid through the same graph path', () => {
    const { tab } = applied(
      applyReplace(checkoutFlow(), { mermaid: 'flowchart TD\n  a --> b' }, options),
    );
    expect(tab.elements.filter((el) => el.type === 'arrow')).toHaveLength(1);
  });

  it('builds a template with the tab theme', () => {
    const { tab } = applied(applyReplace(themed('ocean'), { template: 'swot' }, options));
    expect(tab.elements.length).toBeGreaterThan(0);
    expect(tab.name).toBe('Checkout flow');
  });

  it('takes raw elements, normalised and laid out when asked', () => {
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
    expect(x!.textSize).toBeDefined();
    expect(y!.y).not.toBe(x!.y);
  });

  it('lands every workshop note of an event-storming tab on a lane', () => {
    const note = (id: string, y: number) => ({
      id,
      type: 'sticky',
      x: 0,
      y,
      width: 200,
      height: 200,
      esKind: 'domain-event',
      fillColor: '#fdba74',
      fixedSize: true,
    });
    const tab = { id: 'es', name: 'Wall', kind: 'event-storming', elements: [] } as Tab;
    const { tab: next } = applied(applyReplace(tab, { elements: [note('a', 10)] }, options));
    expect(next.elements[0]).toMatchObject({ y: 0 });
  });

  it('refuses a locked tab', () => {
    const { calls, log } = recording();
    expect(
      refused(applyReplace({ ...checkoutFlow(), locked: true }, { graph }, { ...options, log }))
        .code,
    ).toBe('element_locked');
    expect(calls[0]).toEqual(['[edit-ops] locked', { operation: 0, op: 'replace', scope: 'tab' }]);
  });
});

describe('applyReplace for a new tab', () => {
  it('gives the new tab the finish asked for (docs/specs/008-canvas/finish.md)', () => {
    expect(
      applied(applyReplace(null, { graph }, { ...options, finish: 'sketch' })).tab.finish,
    ).toBe('sketch');
    expect(applied(applyReplace(null, { graph }, options)).tab.finish).toBeUndefined();
  });

  it('builds a graph tab with the given id, name and theme', () => {
    const { tab, createdIds } = applied(
      applyReplace(null, { graph }, { ...options, theme: getBuiltInTheme('ocean') }),
    );
    expect(tab).toMatchObject({ id: 'new-tab', name: 'Fresh', theme: 'ocean' });
    expect(createdIds).toEqual(tab.elements.map((el) => el.id));
  });

  it('names the theme by id, as the MCP passes the document theme to add_tab', () => {
    const { tab } = applied(
      applyReplace(
        null,
        { graph },
        { ...options, themeId: 'ocean', theme: getBuiltInTheme('brand') },
      ),
    );
    expect(tab.theme).toBe('ocean');
  });

  it('builds a template tab whole, with its canvas and kind', () => {
    // Event storming's tab is an event-storming board (docs/specs/021-event-storming/README.md).
    const { tab } = applied(applyReplace(null, { template: 'event-storming' }, options));
    expect(tab).toMatchObject({ id: 'new-tab', templateChosen: true, kind: 'event-storming' });
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
    applyReplace(
      null,
      { graph },
      {
        ...options,
        log,
        theme: { ...getBuiltInTheme('ocean'), id: 'mine' } as unknown as ThemeDefinition,
      },
    );
    expect(calls).toEqual([
      ['[edit-ops] theme-fallback', {}],
      ['[edit-ops] replace', { source: 'graph', elements: 3 }],
    ]);
  });
});

describe('applyReplace refusals', () => {
  const refusal = (body: unknown) => refused(applyReplace(null, body as ReplaceBody, options));

  it('needs exactly one source', () => {
    expect(refusal({}).details).toEqual([
      'replace takes exactly one of graph, mermaid, template, elements',
    ]);
    expect(refusal({ graph, mermaid: 'x' }).code).toBe('invalid_value');
  });

  it('names a malformed graph member', () => {
    expect(refusal({ graph: { nodes: 'a', edges: [] } }).details[0]).toMatch(/^graph.nodes/);
  });

  it('refuses a graph it cannot draw as asked, as the MCP does', () => {
    const graph = {
      style: 'lanes',
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [],
      groups: [{ id: 'g', label: 'Lane', members: ['a'] }],
    };
    expect(refusal({ graph }).details[0]).toMatch(/every node in a lane: "b"/);
  });

  it('refuses Mermaid it cannot read as parse_error, and Mermaid that is not text', () => {
    expect(refusal({ mermaid: 'not a diagram' }).code).toBe('parse_error');
    expect(refusal({ mermaid: 42 }).details).toEqual(['mermaid: expected a string']);
  });

  it('names the templates for an unknown one', () => {
    const rejection = refusal({ template: 'nope' });
    expect(rejection.details).toEqual(['template="nope": not a template']);
    expect(rejection.hint).toContain('flowchart');
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
      'see the format: livediagram schema',
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
