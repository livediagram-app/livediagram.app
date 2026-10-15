import { describe, expect, it } from 'vitest';
import { changesBeyondSettings } from './lock';
import type { FormDefinition } from './model';

const form: FormDefinition = {
  v: 1,
  heading: 'RSVP',
  sections: [{ id: 's-1', title: '', questions: [{ id: 'q-1', type: 'short', prompt: 'Name' }] }],
};

describe('changesBeyondSettings', () => {
  it('lets every setting change', () => {
    const after = { ...form, closesAt: 1, limit: 5, confirmation: 'Ta', closedMessage: 'Shut' };
    expect(changesBeyondSettings(form, after)).toBe(false);
    expect(changesBeyondSettings(after, form)).toBe(false);
  });

  it('reads key order and absent keys alike', () => {
    const reordered = { sections: form.sections, heading: 'RSVP', v: 1, description: undefined };
    expect(changesBeyondSettings(form, reordered as FormDefinition)).toBe(false);
  });

  it('catches a heading, a question or a destination', () => {
    expect(changesBeyondSettings(form, { ...form, heading: 'Party' })).toBe(true);
    const q = { ...form.sections[0]!.questions[0]!, required: true as const };
    expect(changesBeyondSettings(form, { ...form, sections: [{ ...form.sections[0]!, questions: [q] }] })).toBe(true);
    expect(
      changesBeyondSettings(form, { ...form, destination: { tabId: 't', typeId: 'x', status: 'new' } }),
    ).toBe(true);
  });
});
