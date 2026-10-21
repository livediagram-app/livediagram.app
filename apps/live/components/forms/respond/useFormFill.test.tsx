// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicForm } from '@liveplanner/forms';
import { useFormFill } from './useFormFill';

// A number answer in the respondent's own locale (docs/specs/030-forms/forms.md "Number"): a German 3,5 was refused
// as not a number; it is read in the browser's locale before the check and the send.
const FORM = {
  heading: 'Survey',
  confirmation: 'Thanks',
  sections: [
    { id: 's1', title: 'Survey', questions: [{ id: 'q1', type: 'number', prompt: 'How many?' }] },
  ],
} as unknown as PublicForm;

afterEach(() => vi.unstubAllGlobals());

describe('useFormFill', () => {
  it('reads a German 3,5 as 3.5, checks it and sends it so', async () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'de-DE' });
    const submit = vi.fn(async () => ({ kind: 'sent' as const }));
    const { result } = renderHook(() => useFormFill(FORM, submit as never, null));
    act(() => result.current.setAnswer('q1', '3,5'));
    act(() => result.current.blur('q1'));
    expect(result.current.errors.q1).toBeUndefined();
    // What the field shows is what was typed.
    expect(result.current.state.answers.q1).toBe('3,5');
    await act(async () => {
      await result.current.send();
    });
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ answers: { q1: '3.5' } }));
  });
});
