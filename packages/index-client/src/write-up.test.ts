import { describe, expect, it } from 'vitest';
import { readWriteUpAsk, WRITE_UP_BODY_MAX, WRITE_UP_TITLE_MAX, writeUpBody } from './write-up';

describe('readWriteUpAsk', () => {
  it('takes a knowledgebase, a trimmed title and a body', () => {
    expect(readWriteUpAsk({ knowledgebase: 'kb_1', title: ' T ', body: 'B' })).toEqual({
      knowledgebase: 'kb_1',
      title: 'T',
      body: 'B',
    });
  });

  it('refuses anything else', () => {
    for (const raw of [
      null,
      [],
      { knowledgebase: 'bad id!', title: 'T', body: 'B' },
      { knowledgebase: 'kb_1', title: 1, body: 'B' },
      { knowledgebase: 'kb_1', title: '  ', body: 'B' },
      { knowledgebase: 'kb_1', title: 'x'.repeat(WRITE_UP_TITLE_MAX + 1), body: 'B' },
      { knowledgebase: 'kb_1', title: 'T', body: ' ' },
      { knowledgebase: 'kb_1', title: 'T', body: 'x'.repeat(WRITE_UP_BODY_MAX + 1) },
    ]) {
      expect(readWriteUpAsk(raw)).toBeNull();
    }
  });
});

describe('writeUpBody', () => {
  it('keeps a body within the cap as it is', () => {
    expect(writeUpBody('Short')).toBe('Short');
  });

  it('cuts a long body at a line, or hard when no line is near', () => {
    const lines = `${'a'.repeat(WRITE_UP_BODY_MAX - 10)}\n${'b'.repeat(100)}`;
    expect(writeUpBody(lines)).toBe('a'.repeat(WRITE_UP_BODY_MAX - 10));
    const flat = 'c'.repeat(WRITE_UP_BODY_MAX + 50);
    expect(writeUpBody(flat)).toHaveLength(WRITE_UP_BODY_MAX);
  });
});
