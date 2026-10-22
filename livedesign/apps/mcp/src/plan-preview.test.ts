import { describe, expect, it } from 'vitest';
import { buildTemplateTabs } from '@livedesign/templates';
import type { Tab } from '@livedesign/document';
import { planPreviewFor } from './plan-preview';

// A Plan tab's preview as the editor exports it (docs/specs/015-api/mcp-server.md §5).

let n = 0;
const kanban = buildTemplateTabs({ id: 't1', name: 'Board' }, 'kanban', () => `t${++n + 1}`);
const at = (name: string) => kanban.find((t) => t.name === name)!;

describe('planPreviewFor', () => {
  it('lays a Dashboard out rather than stacking its views at the origin', async () => {
    const flow = at('Flow');
    expect(
      new Set(flow.elements.map((e) => `${(e as { x: number }).x},${(e as { y: number }).y}`)).size,
    ).toBe(1);
    const preview = await planPreviewFor(flow, undefined);
    expect(preview).not.toBeNull();
    const spots = new Set(
      preview!.tab.elements.map((e) => `${(e as { x: number }).x},${(e as { y: number }).y}`),
    );
    expect(spots.size).toBeGreaterThan(1);
  });

  it('draws a plan view from the cards it is given', async () => {
    const preview = (await planPreviewFor(at('Flow'), undefined))!;
    const resolve = preview.artWith({ items: new Map() });
    const view = preview.tab.elements.find((e) => e.type === 'shape' && e.shape === 'plan-view') as
      Parameters<typeof resolve>[0] | undefined;
    expect(view).toBeDefined();
    expect(resolve(view!)).toMatch(/<(g|rect|text)/);
  });

  it('draws a Board tab as its board alone, and leaves any other tab to the canvas', async () => {
    const board = (await planPreviewFor(at('Board'), undefined))!;
    expect(board.tab.elements.every((e) => e.type === 'shape' && e.shape === 'plan-board')).toBe(
      true,
    );
    const diagram: Tab = { ...at('Board'), kind: undefined, elements: [] };
    expect(await planPreviewFor(diagram, undefined)).toBeNull();
  });
});
