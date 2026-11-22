import { describe, expect, it } from 'vitest';
import { blockSearchText, findTargets } from './find-targets';
import { fixtureTab, rowsOf } from '@/test/find-fixture';

// docs/specs/007-editor/find-and-replace.md "What is searched", "Share roles".
describe('findTargets', () => {
  it("reads every page in the row's order: the writing, then the elements top to bottom", () => {
    const tab = fixtureTab();
    const targets = findTargets(tab, rowsOf(tab), { scope: 'any' });
    expect(targets.map((t) => [t.pageId, t.text])).toEqual([
      // Page 1: the box (top), its label then its title; the sticky; the table's cells; the checklist's item (it
      // sits right of the table, on the same row, so after it).
      ['p1', 'Plan'],
      ['p1', 'A plan title'],
      ['p1', 'Sticky plan'],
      ['p1', 'Plan'],
      ['p1', 'Owner'],
      ['p1', 'plan B'],
      ['p1', 'Sam'],
      ['p1', 'Write the plan'],
      // The article: its blocks with text, all on its first page until an editor lays them out.
      ['p2', 'The Plan'],
      ['p2', 'Our plan is a plan.'],
      ['p2', 'plan the plan'],
      ['p2', 'plan()'],
    ]);
    expect(targets.every((t) => t.held === null)).toBe(true);
  });

  it('puts a block on the page its editor laid it out on', () => {
    const tab = fixtureTab();
    const targets = findTargets(tab, rowsOf(tab), {
      scope: 'any',
      blockPage: (_flow, id) =>
        id === 'code' || id === 'todo' ? 'p3' : id === 'body' ? 'nowhere' : undefined,
    });
    const blocks = targets.filter((t) => t.ref.kind === 'block');
    expect(blocks.map((t) => [t.text, t.pageId])).toEqual([
      ['The Plan', 'p2'],
      // A page the row does not hold reads as the article's first.
      ['Our plan is a plan.', 'p2'],
      ['plan the plan', 'p3'],
      ['plan()', 'p3'],
    ]);
  });

  it('gives each text a key that stays put across edits', () => {
    const tab = fixtureTab();
    const keys = findTargets(tab, rowsOf(tab), { scope: 'any' }).map((t) => t.key);
    expect(keys).toContain('f:box:label');
    expect(keys).toContain('f:box:pageTitle');
    expect(keys).toContain('c:table:1:0');
    expect(keys).toContain('i:checklist:0');
    expect(keys).toContain('b:f1:body');
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('holds what a Participant may not write, and everything for a Viewer', () => {
    const tab = fixtureTab();
    const participant = findTargets(tab, rowsOf(tab), { scope: 'text' });
    const held = (key: string) => participant.find((t) => t.key === key)!.held;
    expect(held('f:sticky:label')).toBeNull();
    expect(held('c:table:0:0')).toBeNull();
    expect(held('f:box:pageTitle')).toBeNull();
    expect(held('b:f1:body')).toBeNull();
    // A checklist's items are not one of a shape's text fields.
    expect(held('i:checklist:0')).toBe('role');
    const viewer = findTargets(tab, rowsOf(tab), { scope: false });
    expect(viewer.every((t) => t.held === 'role')).toBe(true);
  });

  it('holds locked text for everyone: a locked tab, page, layer or element', () => {
    const base = fixtureTab();
    const lockedEl = fixtureTab({
      elements: base.elements.map((e) => (e.id === 'sticky' ? { ...e, locked: true } : e)),
    });
    expect(
      findTargets(lockedEl, rowsOf(lockedEl), { scope: 'any' }).find(
        (t) => t.key === 'f:sticky:label',
      )!.held,
    ).toBe('locked');
    const lockedTab = fixtureTab({ locked: true });
    expect(
      findTargets(lockedTab, rowsOf(lockedTab), { scope: 'any' }).every((t) => t.held === 'locked'),
    ).toBe(true);
    // Locking any page of an article holds its whole writing; a locked infographic page holds its elements.
    const lockedPages = fixtureTab({
      pages: base.pages!.map((p) => (p.id === 'p3' || p.id === 'p1' ? { ...p, locked: true } : p)),
    });
    expect(
      findTargets(lockedPages, rowsOf(lockedPages), { scope: 'any' }).every(
        (t) => t.held === 'locked',
      ),
    ).toBe(true);
    const lockedLayer = fixtureTab({
      layers: [{ id: 'l1', name: 'Layer 1', locked: true }],
      elements: base.elements.map((e) => ({ ...e, layerId: 'l1' })),
    });
    const onLayer = findTargets(lockedLayer, rowsOf(lockedLayer), { scope: 'any' });
    expect(onLayer.filter((t) => t.ref.kind !== 'block').every((t) => t.held === 'locked')).toBe(
      true,
    );
    expect(onLayer.filter((t) => t.ref.kind === 'block').every((t) => t.held === null)).toBe(true);
  });

  it('skips an element off every page and an article with no page', () => {
    const tab = fixtureTab(
      { articles: { f1: fixtureTab().articles!.f1!, gone: { blocks: [] } } },
      () => [
        {
          id: 'far',
          type: 'text',
          x: -9000,
          y: -9000,
          width: 10,
          height: 10,
          label: 'plan',
        } as never,
      ],
    );
    const targets = findTargets(tab, rowsOf(tab), { scope: 'any' });
    expect(targets.some((t) => t.text === 'plan')).toBe(false);
  });

  it('reads a block as its text', () => {
    expect(blockSearchText({ id: 'd', type: 'divider' })).toBeNull();
    expect(blockSearchText({ id: 'c', type: 'code', text: 'x' })).toBe('x');
  });
});
