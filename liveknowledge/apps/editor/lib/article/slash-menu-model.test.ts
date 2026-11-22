import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { SLASH_GROUPS, SLASH_ITEMS, slashItemById, type SlashItem } from './article-slash-items';
import { matchSlash } from './slash-match';
import { groupJump, modelOf, RECENT, sectionsOfItems, slashModel } from './slash-menu-model';

// docs/specs/030-knowledgebase/page-surface.md "The slash menu": what it offers, Recent, filtering and its keys.
const ids = (query: string) => slashModel(query).items.map((i) => i.id);
const names = (query: string) => slashModel(query).sections.map((s) => s.name);

describe('the slash menu: what it offers', () => {
  it('offers only a knowledgebase page’s blocks, in five groups in order', () => {
    expect(names('')).toEqual([...SLASH_GROUPS]);
    expect(SLASH_GROUPS).toEqual(['Text', 'Lists', 'Media and Embeds', 'Knowledge', 'Layout']);
    const byGroup = Object.fromEntries(
      slashModel('').sections.map((s) => [s.name, s.entries.map((e) => e.item.label)]),
    );
    expect(byGroup).toEqual({
      Text: ['Text', 'Heading 1', 'Heading 2', 'Heading 3', 'Subtitle', 'Quote', 'Code'],
      Lists: ['Bulleted List', 'Numbered List', 'To-Do List'],
      'Media and Embeds': ['Image', 'Bar Chart', 'Pie Chart', 'Line Chart', 'Drawing'],
      Knowledge: ['Link to Page', 'Embed', 'Footnote', 'Table of Contents'],
      Layout: ['Table', 'Divider'],
    });
  });

  it('never offers a Title, a page break, or a canvas shape', () => {
    const all = SLASH_ITEMS.map((i) => i.id);
    for (const gone of [
      'title',
      'pageBreak',
      'page-break',
      'callout',
      'sticky',
      'slide',
      'infographic',
    ])
      expect(all).not.toContain(gone);
    expect(
      SLASH_ITEMS.some((i) => i.action.kind === 'block' && i.action.block === 'pageBreak'),
    ).toBe(false);
  });

  it('gives every entry a line, a unique id and its group', () => {
    expect(new Set(SLASH_ITEMS.map((i) => i.id)).size).toBe(SLASH_ITEMS.length);
    for (const item of SLASH_ITEMS) {
      expect(item.hint.length).toBeGreaterThan(5);
      expect(item.hint.length).toBeLessThanOrEqual(40);
      expect(SLASH_GROUPS).toContain(item.group);
      expect(slashItemById(item.id)).toBe(item);
    }
    expect(slashItemById('sticky')).toBeUndefined();
  });
});

describe('the slash menu: Recent', () => {
  it('heads the menu with the recent entries while nothing is typed, each still in its group', () => {
    const m = slashModel('', ['table', 'h2', 'gone']);
    expect(m.sections[0]!.name).toBe(RECENT);
    expect(m.sections[0]!.entries.map((e) => e.item.id)).toEqual(['table', 'h2']);
    expect(m.sections.map((s) => s.name)).toEqual([RECENT, ...SLASH_GROUPS]);
    expect(m.items.filter((i) => i.id === 'table')).toHaveLength(2);
    expect(m.starts[1]).toBe(2);
  });

  it('shows no Recent with nothing picked, nor while filtering', () => {
    expect(names('')).not.toContain(RECENT);
    expect(slashModel('ta', ['table']).sections.map((s) => s.name)).not.toContain(RECENT);
  });
});

describe('the slash menu: filtering', () => {
  it('ranks a name starting with the query first, then a word of it, then a name holding it', () => {
    expect(ids('h')[0]).toBe('h1');
    // A word of the name: the three lists, the one the query covers most of first.
    expect(ids('list')).toEqual(['todo', 'bullet', 'numbered']);
    expect(ids('ble')[0]).toBe('table');
    expect(ids('div')).toEqual(['divider']);
  });

  it('matches loosely, letters in order with gaps', () => {
    expect(ids('hd2')[0]).toBe('h2');
    expect(ids('tbl')[0]).toBe('table');
    expect(ids('toc')[0]).toBe('toc');
    expect(ids('bcht')).toContain('chart');
    expect(ids('zzq')).toEqual([]);
  });

  it('matches keywords after names, never marking a letter of the name', () => {
    const m = slashModel('ul');
    expect(m.items.map((i) => i.id)).toContain('bullet');
    const drawing = slashModel('diagram').sections.flatMap((s) => s.entries)[0]!;
    expect(drawing.item.id).toBe('drawing');
    expect(drawing.marks).toEqual([]);
    for (const app of ['livediagram', 'liveplanner', 'livehuddle'])
      expect(slashModel(app).items.map((i) => i.id)).toEqual(['embed']);
  });

  it('marks the matched letters of each name', () => {
    const first = (q: string) => slashModel(q).sections[0]!.entries[0]!;
    expect(first('head').marks).toEqual([0, 1, 2, 3]);
    expect(first('hd2').marks).toEqual([0, 3, 8]);
    expect(first('chart').item.id).toBe('chart');
    expect(first('chart').marks).toEqual([4, 5, 6, 7, 8]);
    expect(first('  Tab  ').marks).toEqual([0, 1, 2]);
  });

  it('keeps the groups, each ordered by its best match, the best of all first', () => {
    const m = slashModel('ta');
    // Table starts with it (Layout); Table of Contents too (Knowledge); To-Do List and Bar Chart hold it loosely.
    expect(m.sections[0]!.name).toBe('Layout');
    expect(m.items[0]!.id).toBe('table');
    expect(m.sections.map((s) => s.name)).toContain('Knowledge');
    // Within a group, the better match first.
    const media = slashModel('chart').sections.find((s) => s.name === 'Media and Embeds')!;
    expect(media.entries.map((e) => e.item.id)).toEqual(['chart', 'pie', 'line']);
  });

  it('says nothing matches with an empty model', () => {
    const m = slashModel('qqqqq');
    expect(m.items).toEqual([]);
    expect(m.sections).toEqual([]);
  });

  it('matches every entry with an empty query, unmarked', () => {
    expect(matchSlash('Table', 'grid', '')).toEqual({ score: 0, marks: [] });
    expect(matchSlash('Table', 'grid', ' ')).toEqual({ score: 0, marks: [] });
    expect(matchSlash('Table', '', 'zz')).toBeNull();
  });

  it('filters within a hot budget: a thousand queries over the catalogue', () => {
    const queries = ['h', 'hd2', 'tbl', 'list', 'chart', 'zzq', 'embed', 'to-do list'];
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 1000; i++) slashModel(queries[i % queries.length]!);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });
});

describe('the slash menu: Tab between groups', () => {
  const starts = slashModel('').starts;

  it('jumps to the next group’s first entry, wrapping', () => {
    expect(starts).toEqual([0, 7, 10, 15, 19]);
    expect(groupJump(starts, 0, 1)).toBe(7);
    expect(groupJump(starts, 3, 1)).toBe(7);
    expect(groupJump(starts, 8, 1)).toBe(10);
    expect(groupJump(starts, 20, 1)).toBe(0);
  });

  it('jumps back to the previous group’s first entry, wrapping', () => {
    expect(groupJump(starts, 7, -1)).toBe(0);
    expect(groupJump(starts, 9, -1)).toBe(0);
    expect(groupJump(starts, 0, -1)).toBe(19);
    expect(groupJump([], 3, 1)).toBe(0);
  });
});

describe('the page picker in the slash menu’s shape', () => {
  it('makes a section for each run of one group', () => {
    const item = (id: string, group: SlashItem['group']): SlashItem => ({
      id,
      label: id,
      group,
      keywords: '',
      hint: '',
      action: { kind: 'page-link' },
    });
    const m = modelOf(sectionsOfItems([item('a', 'Pages'), item('b', 'Pages'), item('c', 'New')]));
    expect(m.sections.map((s) => [s.name, s.entries.length])).toEqual([
      ['Pages', 2],
      ['New', 1],
    ]);
    expect(m.starts).toEqual([0, 2]);
    expect(m.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});
