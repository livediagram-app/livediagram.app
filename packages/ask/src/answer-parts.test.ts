import { describe, expect, it } from 'vitest';
import { answerParts, answerWithoutMarkers, markedParts } from './answer-parts';

describe('an answer cut into text and chips', () => {
  it('makes a chip of each marker that names a source, and leaves the rest as text', () => {
    expect(answerParts('It waits [1]. Then retries [2, 3] twice [9].', new Set([1, 2, 3]))).toEqual(
      [
        { kind: 'text', text: 'It waits' },
        { kind: 'cite', number: 1 },
        { kind: 'text', text: '. Then retries' },
        { kind: 'cite', number: 2 },
        { kind: 'cite', number: 3 },
        { kind: 'text', text: ' twice [9].' },
      ],
    );
    expect(answerParts('', new Set([1]))).toEqual([]);
    expect(answerParts('[1][2]', new Set([1, 2]))).toEqual([
      { kind: 'cite', number: 1 },
      { kind: 'cite', number: 2 },
    ]);
  });

  it('takes the markers out for a copy', () => {
    expect(answerWithoutMarkers('It waits [1] .  Then [2, 3] retries [4]!')).toBe(
      'It waits. Then retries!',
    );
  });
});

describe('a passage marked by the question', () => {
  it('marks where a word of the question begins a word of the passage', () => {
    // "Retries" does not begin with "retry": only a word the question's word begins is marked.
    expect(markedParts('Retries are queued; no retry? (pre-retry)', 'What does retry do?')).toEqual(
      [
        { text: 'Retries are queued; no ', marked: false },
        { text: 'retry', marked: true },
        { text: '? (pre-', marked: false },
        { text: 'retry', marked: true },
        { text: ')', marked: false },
      ],
    );
  });

  it('marks a word the question starts, and a match at the very start and end', () => {
    expect(markedParts('payments fail on payment', 'payment')).toEqual([
      { text: 'payments', marked: true },
      { text: ' fail on ', marked: false },
      { text: 'payment', marked: true },
    ]);
  });

  it('leaves a passage whole when the question has no content words, and escapes the rest', () => {
    expect(markedParts('Some text.', 'is it?')).toEqual([{ text: 'Some text.', marked: false }]);
    expect(markedParts('', 'is it?')).toEqual([]);
    expect(markedParts('a c++ note', 'c++ notes?')).toEqual([
      { text: 'a c++ note', marked: false },
    ]);
  });
});
