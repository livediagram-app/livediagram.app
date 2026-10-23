import { describe, expect, it } from 'vitest';
import { ANONYMISED_NAME, ANONYMISED_PERSON, anonymiseJson, anonymiseJsonText } from './anonymise';

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
    const started = performance.now();
    const out = anonymiseJsonText(text, 'user_a');
    const ms = performance.now() - started;
    expect(out.changed).toBe(true);
    // ~2.6 MB of tab: well under a second on any machine that runs the suite.
    expect(ms).toBeLessThan(1000);
  });
});
