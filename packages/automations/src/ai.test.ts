import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  AI_MAX_TOKENS,
  aiCappedWords,
  dropForeignLinks,
  fencedBody,
  keepOwnLink,
  plainSummary,
  readAiReply,
} from './ai';
import { AUTOMATION_AI_SUMMARY_MAX } from './limits';

describe('the reply', () => {
  it('reads a fenced block, with or without its json tag', () => {
    expect(fencedBody('```json\n{"a":1}\n```')).toBe('\n{"a":1}\n');
    expect(fencedBody('before ```{"a":1}``` after')).toBe('{"a":1}');
    expect(fencedBody('no fence')).toBeUndefined();
    expect(fencedBody('``` never closed')).toBeUndefined();
  });

  it('reads the object from any shape the binding answers', () => {
    expect(readAiReply({ response: { summary: 'x' } })).toEqual({ summary: 'x' });
    expect(readAiReply({ response: '{"summary":"x"}' })).toEqual({ summary: 'x' });
    expect(readAiReply({ choices: [{ message: { content: '```json\n{"a":1}\n```' } }] })).toEqual({
      a: 1,
    });
    expect(readAiReply('Sure! {"a":1} there you go')).toEqual({ a: 1 });
    expect(readAiReply({ summary: 'bare' })).toEqual({ summary: 'bare' });
  });

  it('answers null where there is no object', () => {
    for (const raw of [
      null,
      5,
      'no json here',
      '[1,2]',
      '} backwards {',
      { response: 5 },
      { choices: [] },
      { choices: [5] },
      { choices: [{ message: 5 }] },
      { choices: [{}] },
    ])
      expect(readAiReply(raw)).toBeNull();
  });

  it('reads a hostile reply in linear time', () => {
    const hostile = `\`\`\`${' '.repeat(200_000)}`;
    expect(cpuMsOf(() => readAiReply(hostile))).toBeLessThan(cpuBudgetMs(500));
  });
});

describe('links', () => {
  const own = 'see https://x.example/1 and www.mine.example';

  it('keeps a link the person’s words hold, a sentence’s mark aside, and blanks any other', () => {
    expect(keepOwnLink(own)('https://x.example/1.')).toBe('https://x.example/1.');
    expect(keepOwnLink(own)('https://evil.example')).toBe(' ');
    expect(dropForeignLinks('Go to https://evil.example/now, or www.mine.example!', own)).toBe(
      'Go to   or www.mine.example!',
    );
  });

  it('trims a long run of marks in linear time', () => {
    const link = `https://x.example/${'.'.repeat(100_000)}`;
    expect(cpuMsOf(() => keepOwnLink('')(link))).toBeLessThan(cpuBudgetMs(500));
  });
});

describe('a summary', () => {
  it('is plain text: marks, tags, control characters and foreign links gone', () => {
    const text =
      '# Title\n**Bold** `code` <b>tag</b>\t[docs](https://x.example/1) https://evil.example ```js';
    expect(plainSummary(text, 'https://x.example/1')).toBe(
      'Title Bold code tag docs https://x.example/1',
    );
  });

  it('is cut at a word to its length, or mid-word when it has no late space', () => {
    const words = plainSummary('word '.repeat(300), '');
    expect(words.length).toBeLessThanOrEqual(AUTOMATION_AI_SUMMARY_MAX);
    expect(words.endsWith('word…')).toBe(true);
    const run = plainSummary('x'.repeat(50), '', 20);
    expect(run).toBe(`${'x'.repeat(19)}…`);
    expect(plainSummary('short', '')).toBe('short');
  });
});

describe('the words', () => {
  it('names the item its app’s way', () => {
    expect(aiCappedWords('design')).toBe('This design has used its 100 AI steps today');
    expect(AI_MAX_TOKENS.summarise).toBe(300);
  });
});
