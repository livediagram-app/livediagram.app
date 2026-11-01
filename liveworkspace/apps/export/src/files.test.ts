import { describe, expect, it } from 'vitest';
import {
  commentRows,
  commentsCsv,
  commentsJson,
  itemFolder,
  pictureNames,
  readme,
  safeName,
  tabsOfEnvelope,
  toCsv,
  uniqueNames,
  type ReadmeFacts,
} from './files';

describe('safeName', () => {
  it('drops what no file system takes and trims', () => {
    expect(safeName('  Q3: plan/roadmap?*  ')).toBe('Q3 plan roadmap');
    expect(safeName('a\u0000b\tc')).toBe('a b c');
    expect(safeName('..hidden')).toBe('hidden');
  });

  it('falls back for an empty name and cuts a long one by characters', () => {
    expect(safeName('  //  ')).toBe('Untitled');
    expect(safeName('', 'Tab')).toBe('Tab');
    expect([...safeName('✓'.repeat(200))]).toHaveLength(80);
  });

  it('files an item by app, name and id', () => {
    expect(itemFolder('liveplanner', 'Sprint: 1', 'P1')).toBe('liveplanner/Sprint 1 (P1)');
  });
});

describe('tabsOfEnvelope', () => {
  it('finds the tabs under the envelope noun', () => {
    const env = JSON.stringify({
      kind: 'livediagram.document',
      document: { tabs: [{ id: 'a', name: 'One' }, { id: 'b' }, { name: 'no id' }, null] },
    });
    expect(tabsOfEnvelope(env)).toEqual([
      { id: 'a', name: 'One' },
      { id: 'b', name: '' },
    ]);
  });

  it('is empty for anything else', () => {
    expect(tabsOfEnvelope('nope')).toEqual([]);
    expect(tabsOfEnvelope('3')).toEqual([]);
    expect(tabsOfEnvelope('null')).toEqual([]);
    expect(tabsOfEnvelope('{"a":null,"b":{"tabs":1}}')).toEqual([]);
  });
});

describe('names', () => {
  it('numbers repeats', () => {
    expect(uniqueNames(['Sprint', 'sprint', 'Other', 'Sprint'])).toEqual([
      'Sprint',
      'sprint 2',
      'Other',
      'Sprint 3',
    ]);
  });

  it('numbers pictures in order, wider past 99', () => {
    expect(pictureNames([{ name: 'Main' }, { name: '' }])).toEqual(['01 Main.png', '02 Tab.png']);
    expect(pictureNames(Array.from({ length: 100 }, () => ({ name: 'T' })))[0]).toBe('001 T.png');
  });
});

describe('comments', () => {
  const threads = [
    {
      id: 'T1',
      tabId: 't',
      tabName: 'Main',
      on: 'e1',
      resolved: true,
      comments: [
        {
          id: 'C1',
          authorId: 'user_ada',
          authorName: 'Ada',
          text: '=SUM(A1)',
          createdAt: Date.UTC(2026, 0, 2),
        },
        { id: 'C2', authorId: 'user_bo', authorName: null, text: 'Hi, "there"', createdAt: null },
      ],
    },
  ];
  const item = { app: 'livediagram' as const, id: 'A', name: 'Plan' };

  it('keeps only the person’s own for a personal export, every one for a team', () => {
    expect(commentRows(item, threads, 'user_ada').map((r) => r.commentId)).toEqual(['C1']);
    expect(commentRows(item, threads, null).map((r) => r.commentId)).toEqual(['C1', 'C2']);
  });

  it('writes CSV safe for a spreadsheet and JSON with ISO times', () => {
    const rows = commentRows(item, threads, null);
    const csv = commentsCsv(rows);
    expect(csv.split('\r\n')[1]).toBe(
      "livediagram,Plan,A,Main,T1,Yes,Ada,user_ada,2026-01-02T00:00:00.000Z,'=SUM(A1)",
    );
    expect(csv).toContain('"Hi, ""there"""');
    expect(JSON.parse(commentsJson(rows))[1].createdAt).toBeNull();
    expect(JSON.parse(commentsJson(rows))[0].createdAt).toBe('2026-01-02T00:00:00.000Z');
    const unresolved = commentsCsv(
      commentRows(item, [{ ...threads[0]!, resolved: false, tabName: null }], null),
    );
    expect(unresolved).toContain(',A,,T1,No,');
  });

  it('toCsv quotes line breaks', () => {
    expect(toCsv([['a\nb', '+1']])).toBe('"a\nb",\'+1\r\n');
  });
});

describe('readme', () => {
  const base: ReadmeFacts = {
    kind: 'personal',
    teamName: null,
    madeAt: Date.UTC(2026, 10, 1),
    items: 2,
    images: 1,
    comments: 1,
    leftOut: 0,
    problems: [],
  };

  it('describes a personal export', () => {
    const text = readme(base);
    expect(text).toContain('Everything you owned');
    expect(text).toContain('2026-11-01: 2 items, 1 comment and 1 image.');
    expect(text).toContain('profile.json');
    expect(text).toContain('Import as a copy');
    expect(text).not.toContain('Left out');
  });

  it('describes a team export, what was left out and what failed', () => {
    const text = readme({
      ...base,
      kind: 'team',
      teamName: 'Design',
      items: 1,
      comments: 3,
      leftOut: 1,
      problems: [{ app: 'liveplanner', name: 'Board', reason: 'its file could not be read' }],
    });
    expect(text).toContain('Everything the Design team owned');
    expect(text).toContain('1 item, 3 comments.');
    expect(text).toContain('team.json');
    expect(text).toContain('1 item was left out');
    expect(text).toContain('- liveplanner: Board (its file could not be read)');
    expect(readme({ ...base, kind: 'team', teamName: null, leftOut: 3, images: 2 })).toContain(
      '3 items were left out',
    );
    expect(readme({ ...base, items: 1, images: 2, comments: 0 })).toContain(
      '1 item, 0 comments and 2 images.',
    );
    expect(readme({ ...base, kind: 'team', teamName: null })).toContain(
      'Everything your team owned',
    );
  });
});
