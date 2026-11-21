import { describe, expect, it } from 'vitest';
import { RUN_TAB } from './refs';
import { defineItemKinds } from './define';
import { itemNames, refName } from './names';
import { inTabWords, tabWordOf } from './tab-word';
import { eventTabName } from './triggers';

// liveworkspace/docs/specs/018-automations/automations.md "Naming": a knowledgebase's tabs are pages.
describe('tab words', () => {
  it('are pages in a knowledgebase and tabs everywhere else', () => {
    expect(tabWordOf('knowledgebase')).toBe('page');
    for (const word of ['document', 'canvas', 'design', 'Space', 'plan'] as const)
      expect(tabWordOf(word)).toBe('tab');
  });

  it('rewrite every form of the word, and leave other words and every other app alone', () => {
    const line = 'Tab Added: a tab is added; Tabs, tabs and a tab’s name; table, Stable, tabbed';
    expect(inTabWords(line, 'knowledgebase')).toBe(
      'Page Added: a page is added; Pages, pages and a page’s name; table, Stable, tabbed',
    );
    expect(inTabWords(line, 'document')).toBe(line);
  });
});

describe('a knowledgebase’s kinds', () => {
  const kinds = defineItemKinds({ itemWord: 'knowledgebase', collab: true, tabTemplates: true });
  const names = itemNames('knowledgebase', {
    tabs: [{ id: 'p1', name: 'Tab Etiquette' }],
    people: [],
  });

  it('name every shared kind and value by pages, and keep the JSON’s tab', () => {
    expect(kinds.trigger('tab_added')?.name).toBe('Page Added');
    expect(kinds.trigger('tab_removed')?.line).toBe('a page is removed');
    expect(kinds.condition('tab')?.name).toBe('Page');
    expect(kinds.action('add_tab')).toMatchObject({
      name: 'Add a Page from a Template',
      group: 'Pages',
    });
    expect(kinds.action('add_tab')?.format).toContain('"kind":"add_tab"');
    expect(kinds.value('tab.name')?.label).toBe('Page Name');
    expect(kinds.value('tab.url')?.label).toBe('Page Link');
    expect(kinds.value('item.name')?.label).toBe('Knowledgebase Name');
  });

  it('print pages at run time, and never rewrite a name a person gave', () => {
    const addTab = kinds.action('add_tab')!;
    const step = { kind: 'add_tab', template: '', name: 'Tab Notes' };
    expect(addTab.words(step, names)).toEqual([{ chip: 'Add a Page “Tab Notes” from a template' }]);
    expect(addTab.would(step, { names, fill: (t: string) => t })).toBe(
      'Would add a page named “Tab Notes”',
    );
    expect(addTab.summary?.(step, names)).toBe('Add a Page from a Template');
    const summarise = kinds.action('ai')!;
    expect(summarise.words({ kind: 'ai', task: 'summarise', tab: RUN_TAB }, names)).toEqual([
      { chip: 'Summarise the Page with AI' },
    ]);
    const tab = kinds.condition('tab')!;
    const condition = { kind: 'tab', tabs: ['p1'] };
    expect(tab.words(condition, names)[0]).toEqual({ word: 'page is' });
    expect(
      tab.holds(condition, { event: { id: 'e', kind: 'x', at: 1, tab: 'p1' }, names } as never),
    ).toMatchObject({ ok: true, text: 'Page is Tab Etiquette' });
    expect(refName(names, 'tab', '')).toBe('a page');
    expect(refName(names, 'tab', 'gone')).toBe("a page that's gone");
    expect(eventTabName({ id: 'e', kind: 'x', at: 1 }, names)).toBe('a page');
  });

  it('chip a shared trigger by its page name in a rule’s sentence, keeping the page’s own name', () => {
    const added = kinds.trigger('tab_added')!;
    expect(added.words({ kind: 'tab_added' }, names)).toEqual([
      { chip: 'Page Added', trigger: true },
    ]);
    const edited = kinds.trigger('comment_added')!;
    expect(edited.words({ kind: 'comment_added', tab: 'p1' }, names)).toEqual([
      { chip: 'Comment Added', trigger: true },
      { word: 'on' },
      { chip: 'Tab Etiquette' },
    ]);
  });

  it('leave a document’s words as they were', () => {
    const doc = defineItemKinds({ itemWord: 'document', collab: true, tabTemplates: true });
    expect(doc.trigger('tab_added')?.name).toBe('Tab Added');
    expect(doc.value('tab.name')?.label).toBe('Tab Name');
  });
});
