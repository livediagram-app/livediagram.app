import { describe, expect, it } from 'vitest';
import { getBuiltInTheme, type Element, type ShapeElement, type Tab } from '@livediagram/document';
import { applied, lines, refused } from './fixtures/outcomes';
import { applyTabStyle } from './style';

// The `style` changeset body (docs/specs/024-agents/agent-changesets.md "A style restyles an existing tab").
const forest = getBuiltInTheme('forest', 'light');
const sunset = getBuiltInTheme('sunset', 'light');
const box = (id: string, over: Partial<ShapeElement> = {}): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  ...over,
});
const onForest = (): Tab => ({
  id: 't',
  name: 'T',
  theme: 'forest',
  backgroundColor: forest.backgroundColor,
  elements: [
    box('themed', { fillColor: forest.elementFill!, strokeColor: forest.elementStroke! }),
    box('mine', { fillColor: '#123456', finish: 'marker', font: 'lora' }),
  ],
});
const fill = (tab: Tab, id: string) =>
  (tab.elements.find((e) => e.id === id) as ShapeElement).fillColor;

describe('applyTabStyle', () => {
  it("recolours what is on the old theme's colours, keeps a colour set by hand and sets the tab's theme", () => {
    const out = applied(applyTabStyle(onForest(), { theme: 'sunset' }));
    expect(out.tab.theme).toBe('sunset');
    expect(out.tab.backgroundColor).toBe(sunset.backgroundColor);
    expect(fill(out.tab, 'themed')).toBe(sunset.elementFill);
    expect(fill(out.tab, 'mine')).toBe('#123456');
    expect(out.elementOps.length).toBeGreaterThan(0);
    // The inverse undoes the recolour like any other changeset.
    expect(out.inverse.length).toBe(out.elementOps.length);
    expect(lines(applyTabStyle(onForest(), { theme: 'sunset' }))).toHaveLength(1);
  });

  it("sets the finish and the font on the tab, clearing the elements' own", () => {
    const out = applied(applyTabStyle(onForest(), { finish: 'sketch', font: 'inter' }));
    expect(out.tab).toMatchObject({ finish: 'sketch', font: 'inter', theme: 'forest' });
    const mine = out.tab.elements.find((e) => e.id === 'mine')!;
    expect(mine).not.toHaveProperty('finish');
    expect(mine).not.toHaveProperty('font');
    expect(fill(out.tab, 'themed')).toBe(forest.elementFill);
    expect(out.results).toEqual([
      {
        mark: '~',
        ref: 'tab',
        changes: [
          { key: 'finish', from: null, to: 'sketch' },
          { key: 'font', from: null, to: 'inter' },
          { key: 'elements', to: 1 },
        ],
      },
    ]);
  });

  it('reports a field from what the tab had set before, and no element line when none changed', () => {
    const out = applied(
      applyTabStyle({ ...onForest(), elements: [], finish: 'marker' }, { finish: 'sketch' }),
    );
    expect(out.results).toEqual([
      { mark: '~', ref: 'tab', changes: [{ key: 'finish', from: 'marker', to: 'sketch' }] },
    ]);
    expect(out.elementOps).toEqual([]);
  });

  it('refuses a locked tab', () => {
    expect(refused(applyTabStyle({ ...onForest(), locked: true }, { theme: 'sunset' })).code).toBe(
      'element_locked',
    );
  });
});
