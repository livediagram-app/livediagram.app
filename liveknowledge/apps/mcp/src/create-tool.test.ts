import { describe, expect, it } from 'vitest';
import { articlesOf, articleToMarkdown, isValidTab } from '@liveknowledge/document';
import { pagesAsTabs } from './create-tool';

// The pages a new knowledgebase starts with (docs/specs/024-agents/knowledgebase-for-agents.md): tabs in the order
// given, a parent named by an earlier page's title, links between the pages of the call.

const ids = () => {
  let n = 0;
  return () => `id-${(n += 1)}`;
};

describe('pagesAsTabs', () => {
  it('makes a page a tab, each under the earlier page its parent names', () => {
    const built = pagesAsTabs(
      [
        { title: 'Deploys', markdown: 'On Tuesdays. See [[Rollbacks]].' },
        { title: 'Rollbacks', markdown: 'One command.', parent: ' deploys ' },
        { title: 'Later' },
      ],
      ids(),
    );
    if ('error' in built) throw new Error(built.error);
    expect(built.tabs.map((t) => [t.id, t.name, t.parent])).toEqual([
      ['id-1', 'Deploys', undefined],
      ['id-2', 'Rollbacks', 'id-1'],
      ['id-3', 'Later', undefined],
    ]);
    for (const tab of built.tabs) expect(isValidTab(tab)).toBe(true);
    // A link to a page later in the call resolves too.
    const runs = Object.values(articlesOf(built.tabs[0]))[0]!.blocks.flatMap((b) =>
      'runs' in b ? b.runs : [],
    );
    expect(runs.find((r) => r.text === 'Rollbacks')).toMatchObject({ page: 'id-2' });
    expect(articleToMarkdown(Object.values(articlesOf(built.tabs[1]))[0]!)).toContain(
      'One command.',
    );
  });

  it('takes the first of two pages with one title, for a parent and for a link', () => {
    const built = pagesAsTabs(
      [{ title: 'Notes' }, { title: 'Notes' }, { title: 'Child', parent: 'Notes' }],
      ids(),
    );
    if ('error' in built) throw new Error(built.error);
    expect(built.tabs[2]!.parent).toBe('id-1');
  });

  it('refuses a parent that is no earlier page, naming the page and what to do', () => {
    const built = pagesAsTabs(
      [{ title: 'Rollbacks', parent: 'Deploys' }, { title: 'Deploys' }],
      ids(),
    );
    expect(built).toEqual({
      error:
        'Page "Rollbacks": no earlier page of this call is titled "Deploys". ' +
        'Put a parent before the pages under it, and name it by its exact title.',
    });
  });

  it('mints an id a page when none is handed in', () => {
    const built = pagesAsTabs([{ title: 'One' }]);
    expect('tabs' in built && built.tabs[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
