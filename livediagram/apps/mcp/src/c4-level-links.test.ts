import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { buildTemplate } from '@livediagram/templates';

// add_tab with a C4 template links the levels (docs/specs/015-api/mcp-server.md §4.3a): the api is faked, the links
// are the editor's own (linkC4Levels).

const stored = new Map<string, Tab & { rev: number }>();
const submitted: { tabId: string; body: { operations: unknown[]; base: unknown } }[] = [];
let failReads = false;

vi.mock('./api', () => ({
  apiJson: vi.fn(async () => {
    if (failReads) throw new Error('down');
    return { document: { tabs: [...stored.values()].map((t) => ({ id: t.id, name: t.name })) } };
  }),
}));
vi.mock('./template-elements', () => ({
  getTab: vi.fn(async (_e: unknown, _t: string, _d: string, tabId: string) => stored.get(tabId)),
}));
vi.mock('./changeset-client', () => ({
  submitChangeset: vi.fn(
    async (_e: unknown, _t: string, _d: string, tabId: string, body: never) => {
      submitted.push({ tabId, body });
      return {};
    },
  ),
}));

const { c4LinkChangesets, isC4Template, linkC4LevelsOnAddTab } = await import('./c4-level-links');

const tab = (id: string, elements: Element[], rev = 3) => ({ id, name: id, elements, rev });
const env = {} as never;

describe('linking the C4 levels on add_tab', () => {
  beforeEach(() => {
    stored.clear();
    submitted.length = 0;
    failReads = false;
  });

  it('knows a C4 template', () => {
    expect(isC4Template('c4-component')).toBe(true);
    expect(isC4Template('flowchart')).toBe(false);
    expect(isC4Template(null)).toBe(false);
  });

  it('sets the zoom-in link on the Container level and the zoom-out link on the new Component level', () => {
    const con = tab('con', buildTemplate('c4-container', 0, 0));
    const cmp = tab('cmp', buildTemplate('c4-component', 0, 0), 1);
    const changesets = c4LinkChangesets([con, cmp], 'cmp');
    expect(changesets.map((c) => c.tabId)).toEqual(['con', 'cmp']);
    const [toCmp, toCon] = changesets;
    expect(toCmp!.operations).toEqual([
      { op: 'set', target: expect.any(String), fields: { link: { kind: 'tab', tabId: 'cmp' } } },
    ]);
    expect(toCmp!.base.rev).toBe(3);
    expect(Object.keys(toCmp!.base.elements)).toHaveLength(1);
    expect(toCon!.operations).toEqual([
      { op: 'set', target: expect.any(String), fields: { link: { kind: 'tab', tabId: 'con' } } },
    ]);
    // A document with no other level has nothing to link.
    expect(c4LinkChangesets([cmp], 'cmp')).toEqual([]);
  });

  it('writes one changeset per tab it links and says so', async () => {
    stored.set('con', tab('con', buildTemplate('c4-container', 0, 0)));
    stored.set('cmp', tab('cmp', buildTemplate('c4-component', 0, 0)));
    const note = await linkC4LevelsOnAddTab(env, 'tok', 'doc', 'cmp');
    expect(submitted.map((s) => s.tabId)).toEqual(['con', 'cmp']);
    expect(note).toBe('Linked the C4 levels: 2 elements now open the level they name.');
  });

  it('says one link in the singular, nothing when there is nothing to link, and a failure as a note', async () => {
    const con = buildTemplate('c4-container', 0, 0).map((e) =>
      e.type === 'shape' && e.shape === 'boundary'
        ? { ...e, link: { kind: 'url' as const, url: 'https://example.com' } }
        : e,
    );
    stored.set('con', tab('con', con));
    stored.set('cmp', tab('cmp', buildTemplate('c4-component', 0, 0)));
    stored.set('ctx', tab('ctx', []));
    expect(await linkC4LevelsOnAddTab(env, 'tok', 'doc', 'ctx')).toBeNull();
    expect(await linkC4LevelsOnAddTab(env, 'tok', 'doc', 'cmp')).toBe(
      'Linked the C4 levels: 2 elements now open the level they name.',
    );
    stored.clear();
    stored.set('ctx', tab('ctx', buildTemplate('c4-context', 0, 0)));
    stored.set('con', tab('con', con));
    submitted.length = 0;
    expect(await linkC4LevelsOnAddTab(env, 'tok', 'doc', 'ctx')).toBe(
      'Linked the C4 levels: 1 element now opens the level it names.',
    );
    failReads = true;
    expect(await linkC4LevelsOnAddTab(env, 'tok', 'doc', 'cmp')).toMatch(/could not be linked/);
  });
});
