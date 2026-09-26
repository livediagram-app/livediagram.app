import { describe, expect, it } from 'vitest';
import { buildReadNotesPrompt } from './ai-read-prompt';

// The model is asked ONE narrow question (docs/specs/021-event-storming/event-storming.md Phase 8). These pin the two
// rules that make the answer usable, because both are the kind of thing a
// later "improvement" to the wording quietly drops.
describe('buildReadNotesPrompt', () => {
  const prompt = buildReadNotesPrompt();

  it('asks for the text VERBATIM and forbids improving it', () => {
    expect(prompt).toContain('VERBATIM');
    expect(prompt.toLowerCase()).toContain('do not correct');
    expect(prompt.toLowerCase()).toContain('not expand it');
  });

  it('asks it to SAY it cannot read something rather than guess', () => {
    expect(prompt.toLowerCase()).toContain('legible to false');
    expect(prompt.toLowerCase()).toContain('do not guess');
  });

  it('never asks about colour, kind or position — we measured those', () => {
    const lower = prompt.toLowerCase();
    for (const word of ['colour', 'color', 'coordinate', 'position', 'row ', 'kind']) {
      expect(lower, word).not.toContain(word);
    }
  });

  it('names the shape of the answer, keyed by the crop id', () => {
    expect(prompt).toContain('"legible"');
    expect(prompt).toContain('the crop id');
  });
});
