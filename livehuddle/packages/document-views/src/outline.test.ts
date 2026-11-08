import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livehuddle/document';
import { arrowBetween, retiredShapeAt, shapeAt, strokeAt } from './__fixtures__/build';
import { CHECKOUT_IDS, CHECKOUT_REV, checkoutTab } from './__fixtures__/checkout-tab';
import { estimateTokens } from '@liveworkspace/document-views/budget';
import { buildViewModel } from './model';
import { outlineView } from './outline';

const golden = (name: string) => new URL(`./__fixtures__/golden/${name}`, import.meta.url).pathname;
const checkout = () => buildViewModel(checkoutTab(), { rev: CHECKOUT_REV });
const tabOf = (elements: Element[], extra: Partial<Tab> = {}): Tab => ({
  id: 'tab-1',
  name: 'T',
  elements,
  ...extra,
});

describe('outlineView on the checkout tab (R8)', () => {
  // The research render (docs/research/agent-cli/compact-representations.md §4.1) nested by boundary. Nothing nests
  // since part 3 of the element engine (docs/specs/002-project-scope/not-in-livehuddle.md): a stored boundary prints
  // flat as `? boundary`, and what sat on it prints beside it, unindented.
  it('prints flat, a stored boundary as `? boundary` beside what sat on it, the revision on the header', () => {
    const lines = outlineView(checkout()).text.split('\n');
    expect(lines[0]).toMatch(/ · rev 41$/);
    expect(lines).toContain('? boundary c991 "Services"');
    expect(lines.slice(1).every((line) => !line.startsWith(' '))).toBe(true);
  });

  it('matches its goldens', async () => {
    const result = outlineView(checkout());
    await expect(result.text).toMatchFileSnapshot(golden('checkout.outline.txt'));
    await expect(JSON.stringify(result.json, null, 2)).toMatchFileSnapshot(
      golden('checkout.outline.json'),
    );
    await expect(outlineView(checkout(), { style: true }).text).toMatchFileSnapshot(
      golden('checkout.style.txt'),
    );
    await expect(outlineView(checkout(), { budget: 200, door: 'mcp' }).text).toMatchFileSnapshot(
      golden('checkout.outline-mcp-budget-200.txt'),
    );
    expect(result.state).toBe('full');
    expect(result.json.elision).toBeNull();
  });

  it('costs at most 400 estimated tokens, a tenth of the pretty JSON or less', () => {
    const text = outlineView(checkout()).text;
    expect(estimateTokens(text)).toBeLessThanOrEqual(400);
    // read_document's text block before views, as the research measured it.
    const json = JSON.stringify({ tab: checkoutTab() }, null, 2);
    expect(estimateTokens(text) * 10).toBeLessThanOrEqual(estimateTokens(json));
  });

  it('prints one element with only, the header still counting the whole tab (E19)', () => {
    const subtree = outlineView(checkout(), { only: CHECKOUT_IDS.data }).text.split('\n');
    expect(subtree).toEqual([expect.stringContaining('· 30 elements'), '? boundary ca76 "Data"']);
    expect(outlineView(checkout(), { only: CHECKOUT_IDS.stripe }).text.split('\n')).toHaveLength(2);
    expect(outlineView(checkout(), { only: 'nothing' }).text.split('\n')).toHaveLength(1);
  });
});

describe('outline budgets (R20, R21)', () => {
  it('steps down the ladder: notes, attributes, then the trailing lines', () => {
    const states = [400, 350, 300, 200, 60].map(
      (budget) => outlineView(checkout(), { budget }).state,
    );
    expect(states).toEqual([
      'full',
      'notes-dropped',
      'attributes-dropped',
      'lines-dropped',
      'lines-dropped',
    ]);
  });

  it('fits within the budget whenever anything is left to drop', () => {
    for (const budget of [350, 300, 200, 60]) {
      expect(estimateTokens(outlineView(checkout(), { budget }).text)).toBeLessThanOrEqual(budget);
    }
  });

  it('keeps the leading lines, says how many elements the rest held, and keeps JSON in step', () => {
    const full = outlineView(checkout());
    const { text, json, fullTokens } = outlineView(checkout(), { budget: 200 });
    const lines = text.split('\n');
    const kept = lines.slice(1, -1);
    expect(kept).toEqual(
      outlineView(checkout(), { budget: 300 })
        .text.split('\n')
        .slice(1, 1 + kept.length),
    );
    const hidden = Number(/(\d+) elements hidden/.exec(lines.at(-1)!)![1]);
    expect(lines.at(-1)).toBe(
      `… notes hidden; attributes hidden; ${hidden} elements hidden: view --budget ${fullTokens}`,
    );
    expect(hidden).toBeGreaterThan(0);
    expect(json.elision).toMatchObject({
      dropped: ['notes', 'attributes'],
      collapsed: [],
      arguments: { budget: fullTokens },
    });
    expect(json.nodes.length + json.ownLineArrows.length).toBe(kept.length);
    expect(full.json.nodes.length + full.json.ownLineArrows.length).toBeGreaterThan(kept.length);
    expect(json.nodes.every((n) => !('children' in n) || n.children.length === 0)).toBe(true);
  });

  it('points to the full budget when only notes went', () => {
    const { text, fullTokens } = outlineView(checkout(), { budget: 350 });
    expect(text.split('\n').at(-1)).toBe(`… notes hidden: view --budget ${fullTokens}`);
  });

  it('accounts for every printed element when every line goes (I2, E20)', () => {
    const { text, json } = outlineView(checkout(), { budget: 1 });
    const lines = text.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/ 30 elements hidden: /);
    expect(json.nodes).toEqual([]);
    expect(json.ownLineArrows).toEqual([]);
  });

  it('names a lone left-over element in the singular', () => {
    const { text, fullTokens } = outlineView(
      buildViewModel(tabOf([shapeAt('square', 'only-one', 0, 0)])),
      { budget: 1 },
    );
    expect(text.split('\n').at(-1)).toBe(
      `… notes hidden; attributes hidden; 1 element hidden: view --budget ${fullTokens}`,
    );
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: a stored lane, boundary or stack is
// a placeholder that holds nothing. It prints flat as `? <kind>` with its stored label, and what sat on it prints at
// the top level beside it.
describe('a stored layout container in the outline', () => {
  const elements: Element[] = [
    retiredShapeAt('lane', 'lane', 0, 0, 1200, 300, { label: 'Ops' }),
    shapeAt('square', 'deploy', 100, 100, 100, 50, { label: 'Deploy' }),
    retiredShapeAt('boundary', 'vpc', 0, 400, 900, 400, { label: 'VPC' }),
    shapeAt('square', 'db', 100, 500, 100, 50, { label: 'DB' }),
    retiredShapeAt('stack', 'row', 0, 900, 600, 200),
    strokeAt('s1', 10, 950),
    strokeAt('s2', 300, 950),
  ];

  it('prints flat, `? <kind>` with its stored label, beside what sat on it', () => {
    const { text, json } = outlineView(buildViewModel(tabOf(elements)));
    expect(text.split('\n')).toEqual([
      'tab tab-1 "T" · 7 elements: 7 boxes · 5 unknown',
      '? lane lane "Ops"',
      'square deploy "Deploy"',
      '? boundary vpc "VPC"',
      'square db "DB"',
      '? stack row',
      'freehand ×2',
    ]);
    expect(json.nodes[0]).toMatchObject({
      kind: '? lane',
      unknown: true,
      label: 'Ops',
      summary: null,
      children: [],
      collapsed: 0,
    });
  });
});

describe('outline edge cases', () => {
  it('prints an empty tab as its header alone (E1)', () => {
    expect(outlineView(buildViewModel(tabOf([]))).text).toBe('tab tab-1 "T" · 0 elements');
  });

  it('prints unknown kinds with ?, counted, never dropped (R25, E12)', () => {
    const frame = retiredShapeAt('boundary', 'frame', 0, 0, 500, 500, { label: 'Region' });
    const hologram = {
      id: 'holo',
      type: 'hologram',
      x: 10,
      y: 10,
      width: 10,
      height: 10,
      label: 'Hi',
    };
    const blob = { ...shapeAt('square', 'blob', 900, 0), shape: 'blob' };
    const model = buildViewModel(tabOf([frame, hologram, blob] as unknown as Element[]));
    const { text, json } = outlineView(model);
    expect(text).toBe(
      [
        'tab tab-1 "T" · 3 elements: 3 boxes · 3 unknown',
        '? boundary frame "Region"',
        '? hologram holo "Hi"',
        '? blob blob',
      ].join('\n'),
    );
    expect(json.nodes[2]).toMatchObject({ kind: '? blob', unknown: true });
  });

  it('prints a stored arrow as `? arrow` with its label, and folds strokes (E8, E27)', () => {
    const a = shapeAt('square', 'a', 0, 0);
    const free = {
      ...arrowBetween('loose', 'a', 'a', { label: 'retry' }),
      from: { kind: 'free' as const, x: 1, y: 1 },
    };
    const model = buildViewModel(
      tabOf([a, free, strokeAt('s1', 0, 300), strokeAt('s2', 50, 300, true)]),
    );
    expect(outlineView(model).text.split('\n').slice(1)).toEqual([
      'square a',
      'freehand ×2 (1 closed)',
      '? arrow loose "retry"',
    ]);
    expect(outlineView(model).json.nodes[1]).toEqual({
      run: 'freehand',
      refs: ['s1', 's2'],
      closed: 1,
    });
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4: a stored arrow is a retired
  // element, printed on its own line with its stored style like any retired kind, never on its source's line.
  it('prints a stored arrow on its own line, with its stored style', () => {
    const a = shapeAt('square', 'a', 0, 0);
    const b = shapeAt('square', 'b', 300, 0);
    const arrow = arrowBetween('ab', 'a', 'b', { arrowStyle: 'curved', strokeColor: '#dc2626' });
    const lines = outlineView(buildViewModel(tabOf([a, b, arrow])), { style: true }).text.split(
      '\n',
    );
    expect(lines.slice(1)).toEqual([
      'square a',
      'square b',
      '? arrow ab stroke=#dc2626 line=curved',
    ]);
  });
});
