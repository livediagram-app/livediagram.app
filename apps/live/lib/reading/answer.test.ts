import { describe, expect, it } from 'vitest';
import { looksLikeChat, readAnswer, toRead } from './answer';

// The small in-browser model sometimes answers like a chatbot instead of
// reading the note (docs/specs/021-event-storming/event-storming.md Phase 9): a note is a short phrase, and never
// "Yes." or "The answer is 1.". Such an answer is dropped, and the note is
// unread, for the author to type.
describe('looksLikeChat', () => {
  it.each([
    'Yes.',
    'yes',
    'Sure!',
    'Okay.',
    "I'm not.",
    'I am not sure what this says.',
    "I can't read this.",
    'The answer is 1.',
    'The text is written in black marker.',
    'The image shows a sticky note.',
    'This is a yellow sticky note.',
    'This image contains handwriting.',
    'It says hello.',
    "It's a note about orders.",
    'There is no text on it.',
    "Looks like it's a question.",
    'Sorry, I cannot help.',
  ])('rejects %j', (answer) => {
    expect(looksLikeChat(answer)).toBe(true);
  });

  it('rejects an answer longer than any note', () => {
    const rambling = Array.from({ length: 13 }, (_, i) => `word${i}`).join(' ');
    expect(looksLikeChat(rambling)).toBe(true);
  });

  it.each([
    'Order placed',
    'Payment received',
    'Is the customer eligible?',
    'The order shipped',
    'Item added to basket',
    'No stock left',
    'Yes/No decision made',
    'Invoice sent to the customer on the first working day',
    'I/O error logged',
    'Timeslot Activity Room Instructor Slots Draft?',
  ])('keeps a real note %j', (note) => {
    expect(looksLikeChat(note)).toBe(false);
  });
});

describe('toRead', () => {
  it('drops a chat-shaped answer to an unread note', () => {
    expect(toRead('The answer is 1.')).toEqual({ text: '', legible: false });
  });

  it('keeps a reading', () => {
    expect(toRead('Order\nplaced')).toEqual({ text: 'Order placed', legible: true });
  });

  it("still takes the model's own 'no writing' as a blank", () => {
    expect(readAnswer('No writing.')).toEqual({ text: '', legible: false });
  });
});
