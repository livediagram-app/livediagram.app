import { describe, expect, it } from 'vitest';
import { answerLite } from './answer-lite';

const cited = new Set([1, 2]);

describe('an answer as blocks', () => {
  it('reads paragraphs, lists and a heading, with bold, code and chips', () => {
    const blocks = answerLite(
      [
        '## Summary',
        'It **waits** [1], then runs `retry [2]`.',
        'Second line of the paragraph.',
        '',
        '- One [2]',
        '* Two',
        '1. First',
        '2) **Second [1]**',
        'After the list [9].',
      ].join('\n'),
      cited,
    );
    expect(blocks).toEqual([
      { kind: 'paragraph', heading: true, inline: [{ kind: 'text', text: 'Summary' }] },
      {
        kind: 'paragraph',
        heading: false,
        inline: [
          { kind: 'text', text: 'It ' },
          { kind: 'text', text: 'waits', b: true },
          { kind: 'cite', number: 1 },
          { kind: 'text', text: ', then runs ' },
          { kind: 'text', text: 'retry [2]', code: true },
          { kind: 'text', text: '.\nSecond line of the paragraph.' },
        ],
      },
      {
        kind: 'list',
        ordered: false,
        items: [
          [
            { kind: 'text', text: 'One' },
            { kind: 'cite', number: 2 },
          ],
          [{ kind: 'text', text: 'Two' }],
        ],
      },
      {
        kind: 'list',
        ordered: true,
        items: [
          [{ kind: 'text', text: 'First' }],
          [
            { kind: 'text', text: 'Second', b: true },
            { kind: 'cite', number: 1 },
          ],
        ],
      },
      {
        kind: 'paragraph',
        heading: false,
        inline: [{ kind: 'text', text: 'After the list [9].' }],
      },
    ]);
  });

  it('leaves an unclosed mark the characters it was, and an empty answer empty', () => {
    expect(answerLite('A **bold start and a ` tick', cited)).toEqual([
      {
        kind: 'paragraph',
        heading: false,
        inline: [{ kind: 'text', text: 'A **bold start and a ` tick' }],
      },
    ]);
    expect(answerLite('****  ``', cited)).toEqual([
      { kind: 'paragraph', heading: false, inline: [{ kind: 'text', text: '****  ``' }] },
    ]);
    expect(answerLite('\n\n', cited)).toEqual([]);
  });
});
