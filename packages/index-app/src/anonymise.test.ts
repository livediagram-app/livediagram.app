import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  ANONYMISED_NAME,
  ANONYMISED_PERSON,
  anonymiseJson,
  anonymiseJsonText,
  anonymiseReactionsText,
  closedPersonIds,
  isAnySql,
  mentionsAnySql,
} from './anonymise';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';

describe('anonymiseJson', () => {
  it('replaces their id and the display copies beside it, and nothing else', () => {
    const tab = {
      name: 'Board',
      elements: [
        {
          id: 'e1',
          name: 'Card',
          comments: [
            { authorId: 'user_a', authorName: 'Ada', authorColor: '#f00', text: 'hi user_a' },
            { authorId: 'user_b', authorName: 'Bo', text: 'yo' },
          ],
          assignees: ['user_a', 'user_b'],
        },
      ],
    };
    const { value, changed } = anonymiseJson(tab, 'user_a');
    expect(changed).toBe(true);
    const el = value.elements[0]!;
    expect(el.comments[0]).toEqual({
      authorId: ANONYMISED_PERSON,
      authorName: ANONYMISED_NAME,
      authorColor: '#f00',
      text: 'hi user_a',
    });
    expect(el.comments[1]).toEqual(tab.elements[0]!.comments[1]);
    expect(el.assignees).toEqual([ANONYMISED_PERSON, 'user_b']);
    expect(el.name).toBe('Card');
  });

  it('leaves text that never names them alone, unparsed', () => {
    expect(anonymiseJsonText('{"a":1}', 'user_a')).toEqual({ value: '{"a":1}', changed: false });
    expect(anonymiseJsonText('{"a":"user_ab"}', 'user_a').changed).toBe(false);
    expect(JSON.parse(anonymiseJsonText('{"by":"user_a"}', 'user_a').value)).toEqual({
      by: ANONYMISED_PERSON,
    });
  });

  it('walks a large tab within budget', () => {
    const elements = Array.from({ length: 5_000 }, (_, i) => ({
      id: `e${i}`,
      comments: Array.from({ length: 4 }, (_, j) => ({
        authorId: j === 0 ? 'user_a' : 'user_b',
        authorName: 'x',
        text: 'y'.repeat(100),
      })),
    }));
    const text = JSON.stringify({ elements });
    const started = cpuNowMs();
    const out = anonymiseJsonText(text, 'user_a');
    const ms = cpuNowMs() - started;
    expect(out.changed).toBe(true);
    // ~2.6 MB of tab: well under a second on any machine that runs the suite.
    expect(ms).toBeLessThan(cpuBudgetMs(1000));
  });
});

describe('the guests merged into a closed account (Work Tracker 1241)', () => {
  it('lists the account first, then each guest once', () => {
    expect(closedPersonIds('user_a')).toEqual(['user_a']);
    expect(closedPersonIds('user_a', ['guest_g', 'guest_g', 'user_a', 'guest_h'])).toEqual([
      'user_a',
      'guest_g',
      'guest_h',
    ]);
  });

  it('anonymises what the account and its guests left alike, and nobody else', () => {
    const tab = {
      comments: [
        { authorId: 'user_a', authorName: 'Ada', text: 'as Ada' },
        { authorId: 'guest_g', authorName: 'Ada (guest)', text: 'as a guest' },
        { authorId: 'guest_other', authorName: 'Cy', text: 'not hers' },
      ],
    };
    const { value, changed } = anonymiseJson(tab, closedPersonIds('user_a', ['guest_g']));
    expect(changed).toBe(true);
    expect(value.comments.map((c) => [c.authorId, c.authorName])).toEqual([
      [ANONYMISED_PERSON, ANONYMISED_NAME],
      [ANONYMISED_PERSON, ANONYMISED_NAME],
      ['guest_other', 'Cy'],
    ]);
    const text = JSON.stringify(tab);
    expect(anonymiseJsonText(text, ['guest_g']).changed).toBe(true);
    expect(anonymiseJsonText(text, ['guest_nobody', 'user_nobody'])).toEqual({
      value: text,
      changed: false,
    });
    expect(anonymiseJsonText('{bad guest_g', ['guest_g'])).toEqual({
      value: '{bad guest_g',
      changed: false,
    });
    expect(anonymiseJson({ n: 1, ok: true, by: 'guest_g' }, ['guest_g']).value).toEqual({
      n: 1,
      ok: true,
      by: ANONYMISED_PERSON,
    });
  });

  it('names the reactions of any of their reaction persons Deleted account, keeping each key', () => {
    const tab = {
      elements: [
        {
          id: 'e1',
          comments: [
            {
              id: 'c1',
              reactions: [
                { emoji: 'up', by: 'k1', name: 'Ada', person: 'h-ada', on: true },
                { emoji: 'up', by: 'k2', name: 'Ada (guest)', person: 'h-guest', on: true },
                { emoji: 'up', by: 'k3', name: 'Cy', person: 'h-cy', on: true },
                { emoji: 'up', by: 'k4', name: 'Old' },
                null,
              ],
            },
          ],
        },
      ],
    };
    const text = JSON.stringify(tab);
    const out = anonymiseReactionsText(text, ['h-ada', 'h-guest']);
    expect(out.changed).toBe(true);
    const reactions = (JSON.parse(out.value) as typeof tab).elements[0]!.comments[0]!.reactions;
    expect(reactions).toEqual([
      { emoji: 'up', by: 'k1', name: ANONYMISED_NAME, person: ANONYMISED_PERSON, on: true },
      { emoji: 'up', by: 'k2', name: ANONYMISED_NAME, person: ANONYMISED_PERSON, on: true },
      { emoji: 'up', by: 'k3', name: 'Cy', person: 'h-cy', on: true },
      { emoji: 'up', by: 'k4', name: 'Old' },
      null,
    ]);
    // A card thread's comments are a list at the top.
    const thread = JSON.stringify([{ reactions: [{ person: 'h-guest', name: 'G' }] }]);
    expect(JSON.parse(anonymiseReactionsText(thread, ['h-guest']).value)).toEqual([
      { reactions: [{ person: ANONYMISED_PERSON, name: ANONYMISED_NAME }] },
    ]);
    expect(anonymiseReactionsText(text, ['h-nobody'])).toEqual({ value: text, changed: false });
    // Text that mentions them but is not JSON, or holds no reaction of theirs, is left as it is.
    expect(anonymiseReactionsText('{not json h-ada', ['h-ada'])).toEqual({
      value: '{not json h-ada',
      changed: false,
    });
    const named = '{"note":"h-ada"}';
    expect(anonymiseReactionsText(named, ['h-ada'])).toEqual({ value: named, changed: false });
  });

  it('walks a large tab of reactions within budget', () => {
    const elements = Array.from({ length: 5_000 }, (_, i) => ({
      id: `e${i}`,
      comments: [
        {
          reactions: Array.from({ length: 4 }, (_, j) => ({
            by: `k${j}`,
            name: 'x',
            person: j === 0 ? 'h-ada' : `h-${j}`,
          })),
        },
      ],
    }));
    const text = JSON.stringify({ elements });
    const persons = Array.from({ length: 33 }, (_, i) => (i === 32 ? 'h-ada' : `h-guest-${i}`));
    const started = cpuNowMs();
    const out = anonymiseReactionsText(text, persons);
    const ms = cpuNowMs() - started;
    expect(out.changed).toBe(true);
    expect(ms).toBeLessThan(cpuBudgetMs(1000));
  });

  it('matches a JSON list of ids in SQL with one bound parameter', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE t (id TEXT, data TEXT)');
    const insert = db.prepare('INSERT INTO t VALUES (?, ?)');
    insert.run('a', 'x user_a y');
    insert.run('b', 'guest_g');
    insert.run('c', 'z');
    const ids = JSON.stringify(['user_a', 'guest_g']);
    const mention = db.prepare(`SELECT id FROM t WHERE ${mentionsAnySql('data')} ORDER BY id`);
    expect(mention.all(ids).map((r) => r['id'])).toEqual(['a', 'b']);
    const exact = db.prepare(`SELECT id FROM t WHERE ${isAnySql('data', '?1')} ORDER BY id`);
    expect(exact.all(ids).map((r) => r['id'])).toEqual(['b']);
    db.close();
  });
});
