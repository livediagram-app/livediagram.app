import { normaliseRead, type ReadText } from './types';

// What the in-browser model's answer MEANS for a note (spec/139 Phase 9).
//
// A line break is layout, the model's own "no writing" is a blank note, and an
// answer shaped like CHAT rather than like a sticky note is not a reading.

// What the model says when the paper is blank. It answers this consistently on
// an empty crop, which is a better blank-detector than asking it for a
// sentinel token (asking changed how it read real text).
export const BLANK_ANSWERS = /^(no|none|nothing|n\/a|blank|no writing|no text)\b[.!]?$/i;

// A bare yes / no / sure: an answer to a question nobody asked.
const ASSENT = /^(yes|yeah|yep|no|nope|sure|ok|okay|maybe)[.!]*$/i;

// The model talking ABOUT the picture, or about itself, instead of reading it.
// Whole openers, never a lone first word: a note may well begin "The order…".
const CHAT_OPENERS =
  /^(i'm|i am|i can't|i cannot|i don't|i do not|i think|i see|the answer|the text|the image|the picture|the photo|the note|the sticky|the handwriting|the writing|this is|this image|this note|this sticky|this picture|it is|it's|it says|it looks|it reads|there is|there are|there's|looks like|sorry|sure,|unfortunately)\b/i;

// The most words a note carries is eight, measured over 86 labelled notes; past
// twelve the model is narrating, not reading.
export const NOTE_MAX_WORDS = 12;

export function looksLikeChat(text: string): boolean {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean === '') return false;
  if (ASSENT.test(clean) || CHAT_OPENERS.test(clean)) return true;
  return clean.split(' ').length > NOTE_MAX_WORDS;
}

// The model's answer with only the blank rule applied.
export function readAnswer(text: string): ReadText {
  const read = normaliseRead(text);
  return BLANK_ANSWERS.test(read.text) ? { text: '', legible: false } : read;
}

// The model's answer as a note's words: a chat-shaped answer leaves the note
// unread, for the author to type, rather than filled with an invention.
export function toRead(text: string): ReadText {
  const read = readAnswer(text);
  return looksLikeChat(read.text) ? { text: '', legible: false } : read;
}
