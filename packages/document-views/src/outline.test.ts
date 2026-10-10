import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { arrowBetween, shapeAt, strokeAt } from './__fixtures__/build';
import { CHECKOUT_IDS, CHECKOUT_REV, checkoutTab } from './__fixtures__/checkout-tab';
import { golden } from './__fixtures__/golden-path';
import { estimateTokens } from './budget';
import { buildViewModel } from './model';
import { outlineView } from './outline';

// The shared helper, not a second copy: this file's own `new URL(...).pathname`
// answered "/G:/…" on Windows, which the snapshot writer resolved into
// "G:\G:\…" and died on (ENOENT mkdir) — the whole file's snapshots then went
// unwritten and its 16 cases never ran.
const checkout = () => buildViewModel(checkoutTab(), { rev: CHECKOUT_REV });
const tabOf = (elements: Element[], extra: Partial<Tab> = {}): Tab => ({
  id: 'tab-1',
  name: 'T',
  elements,
  ...extra,
});

describe('outlineView on the checkout tab (R8)', () => {
  it('prints the research render, with the revision on the header', () => {
    const research = readFileSync(
      new URL('../../../docs/research/agent-cli/compact-representations.md', import.meta.url),
      'utf8',
    );
    const block = research.split('### 4.1 Rendered\n\n```text\n')[1]!.split('\n```')[0]!;
    const [header, ...rest] = block.split('\n');
    expect(outlineView(checkout()).text).toBe([`${header} · rev 41`, ...rest].join('\n'));
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

  it('prints one subtree with only, the header still counting the whole tab (E19)', () => {
    const subtree = outlineView(checkout(), { only: CHECKOUT_IDS.data }).text.split('\n');
    expect(subtree).toEqual([
      expect.stringContaining('· 30 elements'),
      'frame ca76 "Data"',
      '  cylinder d41e "Orders DB" note="Postgres 16, primary + 1 replica."',
      '  cylinder 822f "Inventory DB"',
    ]);
    expect(outlineView(checkout(), { only: CHECKOUT_IDS.stripe }).text.split('\n')).toHaveLength(2);
    expect(outlineView(checkout(), { only: 'nothing' }).text.split('\n')).toHaveLength(1);
  });
});

describe('outline budgets (R20, R21)', () => {
  it('steps down the ladder: notes, attributes, containers, then the root', () => {
    const states = [400, 380, 300, 200, 60].map(
      (budget) => outlineView(checkout(), { budget }).state,
    );
    expect(states).toEqual([
      'full',
      'notes-dropped',
      'attributes-dropped',
      'containers-collapsed',
      'root-collapsed',
    ]);
  });

  it('fits within the budget whenever anything is left to drop', () => {
    for (const budget of [380, 300, 200]) {
      expect(estimateTokens(outlineView(checkout(), { budget }).text)).toBeLessThanOrEqual(budget);
    }
  });

  it('says what it dropped in one closing line, naming the largest collapsed container', () => {
    const { text, json } = outlineView(checkout(), { budget: 200 });
    expect(text.split('\n').at(-1)).toBe(
      '… notes hidden; attributes hidden; 13 elements in frame c991 hidden: view --only c991',
    );
    expect(json.elision).toMatchObject({
      dropped: ['notes', 'attributes'],
      arguments: { only: 'c991' },
    });
    const services = json.nodes.find((n) => 'ref' in n && n.ref === 'c991');
    expect(services).toMatchObject({ children: [], collapsed: 13 });
  });

  it('points to the full budget when nothing collapsed', () => {
    const { text, fullTokens } = outlineView(checkout(), { budget: 380 });
    expect(text.split('\n').at(-1)).toBe(`… notes hidden: view --budget ${fullTokens}`);
  });

  it('accounts for every printed element when the root goes (I2, E20)', () => {
    const { text, json } = outlineView(checkout(), { budget: 1 });
    const lines = text.split('\n');
    expect(lines).toHaveLength(2);
    const counted = [...lines[1]!.matchAll(/(\d+) elements?(?: in [^;:]+)? hidden/g)].map((m) =>
      Number(m[1]),
    );
    expect(counted.reduce((a, b) => a + b, 0)).toBe(30);
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

describe('outline budgets over nested containers', () => {
  // Two equal frames, the first holding a lane; each holds strokes and boxes.
  const elements: Element[] = [
    shapeAt('frame', 'left', 0, 0, 1000, 1000),
    shapeAt('lane', 'lane', 0, 500, 1000, 400),
    shapeAt('square', 'in-lane-1', 10, 550, 100, 50, { label: 'A long label '.repeat(4) }),
    shapeAt('square', 'in-lane-3', 600, 550, 100, 50, { label: 'Another long label '.repeat(3) }),
    shapeAt('square', 'in-lane-2', 300, 550),
    shapeAt('square', 'in-left', 10, 10),
    shapeAt('frame', 'right', 2000, 0, 1000, 1000),
    shapeAt('square', 'r1', 2010, 10),
    shapeAt('square', 'r2', 2300, 10),
    shapeAt('square', 'r3', 2600, 10),
    strokeAt('s1', 2010, 300),
    strokeAt('s2', 2300, 300),
  ];
  const model = buildViewModel(tabOf(elements));

  it('prints a run inside a container, in text and JSON', () => {
    const { text, json } = outlineView(model);
    expect(text.split('\n')).toContain('  freehand ×2');
    expect(json.nodes[1]).toMatchObject({
      children: [{}, {}, {}, { run: 'freehand', refs: ['s1', 's2'] }],
    });
  });

  it('collapses the earlier of equal containers first, never a container inside a collapsed one', () => {
    const budgets = Array.from({ length: 80 }, (_, i) => i + 1);
    const collapsedRefs = budgets.map((budget) => {
      const { json } = outlineView(model, { budget });
      return (json.elision?.collapsed ?? []).map((c) => c.ref).join(',');
    });
    expect(collapsedRefs).toContain('left');
    expect(collapsedRefs).toContain('left,right');
    expect(collapsedRefs.some((refs) => refs.includes('lane'))).toBe(false);
    expect(collapsedRefs.includes('right')).toBe(false);
  });
});

describe('outline edge cases', () => {
  it('prints an empty tab as its header alone (E1)', () => {
    expect(outlineView(buildViewModel(tabOf([]))).text).toBe('tab tab-1 "T" · 0 elements');
  });

  it('prints unknown kinds with ?, counted and contained by geometry, never dropped (R25, E12)', () => {
    const frame = shapeAt('frame', 'frame', 0, 0, 500, 500);
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
        'tab tab-1 "T" · 3 elements: 2 boxes, 1 frame · 2 unknown',
        'frame frame "Frame"',
        '  ? hologram holo "Hi"',
        '? blob blob',
      ].join('\n'),
    );
    expect(json.nodes[1]).toMatchObject({ kind: '? blob', unknown: true });
  });

  it('prints own-line arrows after the root, and folds strokes (E8, E27)', () => {
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
      'arrow loose free → a "retry"',
    ]);
    expect(outlineView(model).json.nodes[1]).toEqual({
      run: 'freehand',
      refs: ['s1', 's2'],
      closed: 1,
    });
  });

  it('prints style on arrows with style, and drops it with the attributes', () => {
    const a = shapeAt('square', 'a', 0, 0);
    const b = shapeAt('square', 'b', 300, 0);
    const arrows = Array.from({ length: 6 }, (_, i) =>
      arrowBetween(`ab${i}`, 'a', 'b', { arrowStyle: 'curved', strokeColor: '#dc2626' }),
    );
    const model = buildViewModel(tabOf([a, b, ...arrows]));
    const styled = 'b stroke=#dc2626 line=curved';
    expect(outlineView(model, { style: true }).text.split('\n')[1]).toBe(
      `square a → ${Array(6).fill(styled).join(', ')}`,
    );
    const budget = Array.from({ length: 200 }, (_, i) => i + 1).find(
      (b) => outlineView(model, { style: true, budget: b }).state === 'attributes-dropped',
    );
    const dropped = outlineView(model, { style: true, budget });
    expect(dropped.text.split('\n')[1]).toBe('square a → b, b, b, b, b, b');
  });
});
