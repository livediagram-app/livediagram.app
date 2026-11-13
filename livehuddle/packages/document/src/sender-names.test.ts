import { describe, expect, it } from 'vitest';
import { NOTE_AUTHOR_MAX } from './office-social';
import { ARCADE_NAME_MAX } from './arcade-scores';
import { noteAuthorName, stampSenderName } from './sender-names';

// docs/specs/009-elements/social-pieces.md "The author is the sender's", "Trust" (Work Tracker 624).
describe('stampSenderName', () => {
  const pin = (author: string) => ({
    kind: 'el-delta',
    tabId: 't',
    elementId: 'nb',
    delta: { kind: 'notice-pin', note: { id: 'n1', text: 'Hi', author, by: 'k', at: 1 } },
  });
  const score = (name: string) => ({
    kind: 'el-delta',
    tabId: 't',
    elementId: 'am',
    delta: { kind: 'arcade-score', score: { id: 's1', name, score: 10, ms: 1000, by: 'k', at: 1 } },
  });

  it("writes a pin's author and a score's name from the sender, whatever the frame claimed", () => {
    expect(stampSenderName(pin('Their Boss'), 'Ann')).toEqual(pin('Ann'));
    expect(stampSenderName(score('Their Boss'), 'Ann')).toEqual(score('Ann'));
  });

  it('cuts a long name to fit, and falls back with none', () => {
    const long = 'x'.repeat(200);
    const note = stampSenderName(pin('a'), long) as { delta: { note: { author: string } } };
    expect(note.delta.note.author.length).toBeLessThanOrEqual(NOTE_AUTHOR_MAX);
    const s = stampSenderName(score('a'), long) as { delta: { score: { name: string } } };
    expect(s.delta.score.name.length).toBeLessThanOrEqual(ARCADE_NAME_MAX);
    expect(stampSenderName(pin('Ann'), '  ')).toEqual(pin('Someone'));
    expect(stampSenderName(score('Ann'), '')).toEqual(score('Guest'));
  });

  it('leaves every other op the same object', () => {
    const others: unknown[] = [
      null,
      'op',
      { kind: 'cursor', x: 1 },
      { kind: 'el-delta' },
      { kind: 'el-delta', delta: null },
      { kind: 'el-delta', delta: { kind: 'notice-unpin', noteId: 'n1', by: 'k' } },
      { kind: 'el-delta', delta: { kind: 'notice-pin', note: null } },
      { kind: 'el-delta', delta: { kind: 'arcade-score', score: 'x' } },
    ];
    for (const op of others) expect(stampSenderName(op, 'Ann')).toBe(op);
  });

  it('noteAuthorName trims and cuts', () => {
    expect(noteAuthorName('  Ann  ')).toBe('Ann');
    expect(noteAuthorName('')).toBe('Someone');
  });
});
