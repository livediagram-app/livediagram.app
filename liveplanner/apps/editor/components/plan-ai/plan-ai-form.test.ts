import { describe, expect, it } from 'vitest';
import type { FormDefinition } from '@liveplanner/forms';
import { applyFormTurn } from './plan-ai-form';
import { TYPES } from './plan-ai-fixtures';

// Plan AI on a form (docs/specs/026-plan/plan-ai.md "On a form").

const FORM: FormDefinition = {
  v: 1,
  heading: 'Feedback',
  sections: [
    {
      id: 's1',
      title: '',
      questions: [
        { id: 'q1', type: 'short', prompt: 'Your name' },
        { id: 'q2', type: 'paragraph', prompt: 'What did you think?' },
      ],
    },
  ],
};

let n = 0;
const run = (changes: Record<string, unknown>[], form = FORM) =>
  applyFormTurn({
    projectId: 'p1',
    formTab: { id: 'f', name: 'Feedback' },
    form,
    tabs: [{ id: 'f', name: 'Feedback', kind: 'form' }],
    types: TYPES,
    changes: changes as never,
    newId: (prefix) => `${prefix}n${++n}`,
  });

describe('applyFormTurn', () => {
  it('adds, rewords, requires and reorders questions as one form', () => {
    const out = run([
      { op: 'add_question', question: { type: 'email', prompt: 'Your email', required: true } },
      { op: 'set_question', question: 'q2', set: { prompt: 'How was it?' } },
      { op: 'move_question', question: 'q2', before: 'q1' },
    ]);
    expect(out.form).not.toBeNull();
    const qs = out.form!.sections[0]!.questions;
    expect(qs.map((q) => q.prompt)).toEqual(['How was it?', 'Your name', 'Your email']);
    expect(qs[2]).toMatchObject({ type: 'email', required: true });
    expect(out.lines.length).toBeGreaterThan(0);
    expect(out.lines.every((l) => l.ok && /^[A-Z]/.test(l.text))).toBe(true);
    // The form it was given is left as it was.
    expect(FORM.sections[0]!.questions).toHaveLength(2);
  });

  it('makes none of the changes when one is refused, and says which', () => {
    const out = run([
      { op: 'set_question', question: 'q1', set: { prompt: 'Name' } },
      { op: 'delete_question', question: 'q9' },
    ]);
    expect(out.form).toBeNull();
    expect(out.lines).toEqual([{ ok: false, text: expect.stringContaining('Change 2') }]);
  });

  it('refuses a change that does not read, naming it', () => {
    const out = run([{ op: 'add_question', question: { type: 'telepathy' } }]);
    expect(out.form).toBeNull();
    expect(out.lines[0]!.text).toMatch(/^Change 1 \(add_question\) couldn’t be read/);
  });

  it('leaves where responses go to Form Settings', () => {
    const out = run([{ op: 'responds_to', to: 'board' }]);
    expect(out.form).toBeNull();
    expect(out.lines[0]!.text).toMatch(/Form Settings|couldn’t be read/);
  });
});
