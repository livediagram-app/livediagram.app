import { describe, expect, it } from 'vitest';
import { archiveOf } from './__fixtures__/archive';
import { stripNotionId } from './notion';
import { planImport } from './plan';

const id = (digit: string) => digit.repeat(32);
const ROOT = `Export-7f/Team Handbook ${id('0')}`;
const enc = (path: string) => encodeURIComponent(path).replace(/%2F/g, '/');

const exported = () =>
  archiveOf({
    [`${ROOT}.md`]: [
      '# Team Handbook',
      '',
      `[Roadmap](${enc(`Team Handbook ${id('0')}/Roadmap ${id('1')}.md`)})`,
      `[Tasks](${enc(`Team Handbook ${id('0')}/Tasks ${id('2')}.csv`)})`,
      '<aside>',
      '\u{1F4A1} Ask before you merge.',
      '</aside>',
      '<details>',
      '<summary>On call</summary>',
      '',
      'Page the lead.',
      '</details>',
      `![Chart](${enc(`Team Handbook ${id('0')}/chart.png`)})`,
    ].join('\n'),
    [`${ROOT}/Roadmap ${id('1')}.md`]: `# Roadmap\n\nBack to [the handbook](${enc(`../Team Handbook ${id('0')}.md`)}).`,
    [`${ROOT}/Tasks ${id('2')}.csv`]: 'Name,Status\nShip,Done',
    [`${ROOT}/Tasks ${id('2')}_all.csv`]: 'Name,Status\nShip,Done\nPlan,To do',
    [`${ROOT}/Tasks ${id('2')}/Ship ${id('3')}.md`]: '# Ship\n\nDone.',
    [`${ROOT}/Meetings ${id('4')}.md`]: '# Meetings\n\nEvery Monday.',
    [`${ROOT}/Meetings ${id('4')}.csv`]: 'Date,Notes\nMonday,"Short, sharp"',
    [`${ROOT}/Views ${id('8')}_all.csv`]: 'A\n1\n2',
    [`${ROOT}/Views ${id('8')}.csv`]: 'A\n1',
    [`${ROOT}/Empty ${id('7')}.md`]: '# Empty',
    [`${ROOT}/Empty ${id('7')}.csv`]: '',
    [`${ROOT}/Archive ${id('5')}/Old Plan ${id('6')}.md`]: 'No heading.',
    [`${ROOT}/chart.png`]: 4,
  });

describe('Notion', () => {
  it('strips an id from a name, and keeps a name that is only an id', () => {
    expect(stripNotionId(`Roadmap ${id('a')}`)).toBe('Roadmap');
    expect(stripNotionId(id('a'))).toBe(id('a'));
    expect(stripNotionId('Plain Name')).toBe('Plain Name');
  });

  it('makes the tree from the nested folders, the ids gone from every title', async () => {
    const plan = await planImport('notion', exported());
    expect(plan.pages.map((page) => [page.key, page.title, page.parentKey])).toEqual([
      ['p1', 'Team Handbook', null],
      ['p2', 'Archive', 'p1'],
      ['p3', 'Old Plan', 'p2'],
      ['p4', 'Empty', 'p1'],
      ['p5', 'Meetings', 'p1'],
      ['p6', 'Roadmap', 'p1'],
      ['p7', 'Tasks', 'p1'],
      ['p8', 'Ship', 'p7'],
      ['p9', 'Views', 'p1'],
    ]);
    expect(plan.summary).toMatchObject({ pages: 9, pictures: 1, ignoredFiles: 0, skipped: [] });
  });

  it('resolves encoded links, and turns callouts into quotes and toggles into headings', async () => {
    const plan = await planImport('notion', exported());
    expect(plan.pages[0]!.markdown).toBe(
      [
        '[Roadmap](knowledgebase-page:p6)',
        '[Tasks](knowledgebase-page:p7)',
        '> \u{1F4A1} Ask before you merge.',
        '### On call',
        '',
        'Page the lead.',
        '![Chart](knowledgebase-picture:0)',
      ].join('\n'),
    );
    expect(plan.pages[5]!.markdown).toBe('Back to [the handbook](knowledgebase-page:p1).');
  });

  it('makes a database a table on its page, from the file with every row', async () => {
    const plan = await planImport('notion', exported());
    expect(plan.pages[6]!.markdown).toBe(
      ['| Name | Status |', '| --- | --- |', '| Ship | Done |', '| Plan | To do |'].join('\n'),
    );
    expect(plan.pages[4]!.markdown).toBe(
      ['Every Monday.', '', '| Date | Notes |', '| --- | --- |', '| Monday | Short, sharp |'].join(
        '\n',
      ),
    );
    expect(plan.pages[3]!.markdown).toBe('');
    expect(plan.pages[8]!.markdown).toBe(['| A |', '| --- |', '| 1 |', '| 2 |'].join('\n'));
  });

  it('reports a database it cannot read, and keeps the rest', async () => {
    const archive = exported();
    archive.find((entry) => entry.path.endsWith('_all.csv'))!.read = async () => {
      throw new Error('broken');
    };
    archive.find((entry) => entry.path.includes('Roadmap'))!.read = async () => {
      throw new Error('broken');
    };
    const plan = await planImport('notion', archive);
    // Its folder still holds a page, so the folder keeps an empty page of its name.
    expect(plan.pages[5]).toMatchObject({ title: 'Tasks', markdown: '' });
    expect(plan.pages[6]).toMatchObject({ title: 'Ship', parentKey: 'p6' });
    expect(plan.summary.skipped).toEqual([
      {
        path: `${ROOT}/Roadmap ${id('1')}.md`,
        reason: 'page-failed',
        detail: 'The page could not be read.',
      },
      {
        path: `${ROOT}/Tasks ${id('2')}_all.csv`,
        reason: 'page-failed',
        detail: 'The page could not be read.',
      },
    ]);
  });
});
