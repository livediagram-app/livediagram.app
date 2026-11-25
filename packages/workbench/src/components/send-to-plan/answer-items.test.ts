// An Ask AI answer's items for Send to Plan (liveworkspace/docs/specs/020-ask/ask.md "Sending an answer on").
import { cpuBudgetMs, cpuLeastMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import { answerItems, itemStart, plainWords } from './answer-items';

describe('answerItems', () => {
  it('makes a card of each top-level item, bulleted or numbered', () => {
    expect(
      answerItems(
        'Next steps:\n\n- Book the venue\n* Send the invites\n+ Order food\n• Confirm the AV\n\n1. Draft\n2) Review',
      ),
    ).toEqual([
      'Book the venue',
      'Send the invites',
      'Order food',
      'Confirm the AV',
      'Draft',
      'Review',
    ]);
  });

  it('keeps nested items and continued lines with their item', () => {
    expect(
      answerItems(
        '1. Ship the beta\n   - QA sign-off\n\t* Release notes\n   by Friday\n2. Tell the team\n\n   They need a heads-up.',
      ),
    ).toEqual([
      'Ship the beta\n- QA sign-off\n- Release notes\nby Friday',
      'Tell the team\nThey need a heads-up.',
    ]);
  });

  it('ends a list at a paragraph or a heading after it', () => {
    expect(answerItems('- One\n\nIn short, that is it.\n- Two\n## More\n- Three')).toEqual([
      'One',
      'Two',
      'Three',
    ]);
  });

  it('reads a later, less indented list as items of their own', () => {
    expect(answerItems('  - Deep\n- Shallow')).toEqual(['Deep', 'Shallow']);
  });

  it('takes out bold and code marks, and reads Windows line ends', () => {
    expect(answerItems('- **Fix** the `build`\r\n- __Ship__ it\r\n')).toEqual([
      'Fix the build',
      'Ship it',
    ]);
  });

  it('makes one card of an answer with no list, and none of an empty one', () => {
    expect(answerItems('The **plan** has three phases.\n\nIt ends in May.')).toEqual([
      'The plan has three phases.\n\nIt ends in May.',
    ]);
    expect(answerItems('   \n\n')).toEqual([]);
    // An empty item makes no card.
    expect(answerItems('- \n- Real')).toEqual(['Real']);
  });

  it('does not read a rule, bold text, a long number or a bare mark as an item', () => {
    expect(itemStart('---', 0)).toBe(-1);
    expect(itemStart('**Bold**', 0)).toBe(-1);
    expect(itemStart('2026. A year', 0)).toBe(-1);
    expect(itemStart('12 apples', 0)).toBe(-1);
    expect(itemStart('3.x', 0)).toBe(-1);
    expect(itemStart('-', 0)).toBe(-1);
    expect(itemStart('12. Twelve', 0)).toBe(4);
  });

  it('keeps a single mark as written', () => {
    expect(plainWords('a * b _ c')).toBe('a * b _ c');
  });

  it('reads a huge answer in linear time', () => {
    // The worst inputs a tokenizer could stumble on: runs of spaces, digits and marks, and many items.
    const spaces = `-${' '.repeat(100_000)}x`;
    const digits = `${'1'.repeat(100_000)}. x`;
    const marks = '*'.repeat(100_000);
    const many = Array.from({ length: 20_000 }, (_, i) => `${i % 999}. item ${i}\n   - sub`).join(
      '\n',
    );
    const ms = cpuLeastMsOf(() => {
      answerItems(spaces);
      answerItems(digits);
      answerItems(marks);
      answerItems(many);
    }, 3);
    expect(answerItems(many)).toHaveLength(20_000);
    expect(ms).toBeLessThan(cpuBudgetMs(250));
  });
});
