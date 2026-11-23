import { describe, expect, it } from 'vitest';
import { ASK_MAX_GAPS, askAnswerStream, parseAskAnswer, type SentPassage } from './answer';

const numbered = (...ids: string[]): SentPassage[] =>
  ids.map((id, at) => ({ number: at + 1, passage: { id } }));

describe('the answer read', () => {
  const passages = numbered('a', 'b', 'c');

  it('reads the text, the citations, what was not used and the gaps', () => {
    const answer = parseAskAnswer(
      [
        '<answer>',
        'We deploy on Tuesdays [2]. Rollbacks take one command [1][2].',
        'The passages do not say who approves a deploy.',
        '</answer>',
        '<not_used passage="3">Older than passage 2\n and says Fridays.</not_used>',
        '<gap>Who approves a deploy?</gap>',
      ].join('\n'),
      passages,
    );
    // Numbered as first cited: passage 2 is the answer's 1, passage 1 its 2; set aside, passage 3 comes after.
    expect(answer).toEqual({
      text: 'We deploy on Tuesdays [1]. Rollbacks take one command [2][1].\nThe passages do not say who approves a deploy.',
      cited: [
        { number: 1, sent: 2, passageId: 'b' },
        { number: 2, sent: 1, passageId: 'a' },
      ],
      notUsed: [
        { number: 3, sent: 3, passageId: 'c', reason: 'Older than passage 2 and says Fridays.' },
      ],
      gaps: ['Who approves a deploy?'],
    });
  });

  it('cites only passages that were sent', () => {
    const answer = parseAskAnswer(
      '<answer>True [2]. Invented [9] [14]. Also [0].</answer><not_used passage="7">x</not_used><not_used passage="1">a</not_used><not_used passage="1">again</not_used>',
      passages,
    );
    expect(answer.text).toBe('True [1]. Invented. Also.');
    expect(answer.cited).toEqual([{ number: 1, sent: 2, passageId: 'b' }]);
    expect(answer.notUsed).toEqual([{ number: 2, sent: 1, passageId: 'a', reason: 'a' }]);
  });

  it('sets nothing aside for a bare mark with no reason', () => {
    const answer = parseAskAnswer(
      '<answer>True [2].</answer><not_used passage="1"></not_used><not_used passage="3">  </not_used>',
      passages,
    );
    expect(answer.notUsed).toEqual([]);
    expect(answer.text).toBe('True [1].');
  });

  it('numbers one source 1, whatever it was sent as, and reads a list of numbers in one marker', () => {
    // The owner's answer: one source, sent as passage 2, shown as 1.
    const one = parseAskAnswer('<answer>Use blue for all text colours [2].</answer>', passages);
    expect(one.text).toBe('Use blue for all text colours [1].');
    expect(one.cited).toEqual([{ number: 1, sent: 2, passageId: 'b' }]);
    const listed = parseAskAnswer(
      '<answer>A [3, 1]. B [9, 3]. C [7, 8]. D [2, 2].</answer>',
      passages,
    );
    expect(listed.text).toBe('A [1, 2]. B [1]. C. D [3].');
    expect(listed.cited.map((c) => [c.number, c.sent])).toEqual([
      [1, 3],
      [2, 1],
      [3, 2],
    ]);
  });

  it('reads a reply that ignores the form as an answer without citations', () => {
    expect(parseAskAnswer('  The passages do not cover this.  ', passages)).toEqual({
      text: 'The passages do not cover this.',
      cited: [],
      notUsed: [],
      gaps: [],
    });
    expect(parseAskAnswer('<answer>Cut off mid sen', passages).text).toBe('Cut off mid sen');
    expect(parseAskAnswer('', passages).text).toBe('');
  });

  it('bounds the gaps: each once, one line, at most five', () => {
    const gaps = Array.from({ length: 9 }, (_x, at) => `<gap>Gap ${at}?</gap>`).join('');
    const answer = parseAskAnswer(
      `<answer>Nothing.</answer><gap> </gap><gap>Gap 0?</gap>${gaps}<gap>${'g'.repeat(900)}</gap>`,
      passages,
    );
    expect(answer.gaps).toEqual(['Gap 0?', 'Gap 1?', 'Gap 2?', 'Gap 3?', 'Gap 4?']);
    expect(answer.gaps).toHaveLength(ASK_MAX_GAPS);
    expect(parseAskAnswer(`<gap>${'g'.repeat(900)}</gap>`, passages).gaps[0]).toHaveLength(300);
  });

  it("shows the answer as it streams, never the form's tags or what follows the answer", () => {
    const reply =
      '<answer>\nWe deploy on Tuesdays [2]. Is 1 < 2? Yes.\n</answer>\n<gap>Who approves?</gap>';
    for (const size of [1, 2, 3, 7, 1000]) {
      const stream = askAnswerStream(passages);
      let shown = '';
      for (let at = 0; at < reply.length; at += size)
        shown += stream.push(reply.slice(at, at + size));
      expect(shown).toBe('We deploy on Tuesdays [1]. Is 1 < 2? Yes.\n');
      expect(stream.finish()).toEqual({
        text: 'We deploy on Tuesdays [1]. Is 1 < 2? Yes.',
        cited: [{ number: 1, sent: 2, passageId: 'b' }],
        notUsed: [],
        gaps: ['Who approves?'],
      });
    }
  });

  it('renumbers markers as they stream, however the pieces fall, as the finished answer does', () => {
    const reply = '<answer>A [3]. B [1, 3]. C [9]. D [2][3]. [</answer>';
    for (const size of [1, 2, 4, 1000]) {
      const stream = askAnswerStream(passages);
      let shown = '';
      for (let at = 0; at < reply.length; at += size)
        shown += stream.push(reply.slice(at, at + size));
      const done = stream.finish();
      expect(shown).toBe('A [1]. B [2, 1]. C. D [3][1]. [');
      expect(done.text).toBe(shown);
      expect(done.cited.map((c) => c.sent)).toEqual([3, 1, 2]);
    }
    // A marker still open when the stream pauses is held, then shown whole.
    const held = askAnswerStream(passages);
    expect(held.push('<answer>Fact [')).toBe('Fact');
    expect(held.push('2')).toBe('');
    expect(held.push('] more')).toBe(' [1] more');
  });

  it('shows a streamed reply that does not open with the form as it comes', () => {
    const stream = askAnswerStream(passages);
    expect(stream.push('<')).toBe('');
    expect(stream.push('an')).toBe('');
    // A space at a piece's end waits for what follows: a marker that cites nothing goes with it.
    expect(stream.push('y text ')).toBe('<any text');
    expect(stream.push('more</ans')).toBe(' more');
    expect(stream.push('wers> end')).toBe('</answers> end');
    expect(stream.finish().text).toBe('<any text more</answers> end');
    const plain = askAnswerStream(passages);
    expect(plain.push('  Plain words.')).toBe('Plain words.');
  });
});
