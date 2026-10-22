// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FormLinkState } from '@/hooks/forms/useFormLink';
import { FormProblems, formProblemCount } from './FormProblems';
import { FormStatusBar } from './FormStatusBar';

// A form's problems (docs/specs/030-forms/forms.md "Publishing and the form link"): every one listed together, and the
// status bar's Problems with this Form, an Editor's, opening where they are.

afterEach(cleanup);

describe('FormProblems', () => {
  it('lists responses with nowhere to go and each failing check together', () => {
    const fix = vi.fn();
    const show = vi.fn();
    render(
      <FormProblems
        title="Before publishing:"
        problem="no_destination"
        notReady={[{ kind: 'unworded', questionId: 'q-1' }, { kind: 'no_questions' }]}
        onFixDestination={fix}
        onShow={show}
      />,
    );
    expect(screen.getByText(/Responses have nowhere to go/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Choose Where Responses Go' }));
    expect(fix).toHaveBeenCalledOnce();
    // Show for a question's problem; none for "add a question", which has nothing to show.
    expect(screen.getAllByRole('button', { name: 'Show' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(show).toHaveBeenCalledWith({ kind: 'unworded', questionId: 'q-1' });
  });

  it('draws nothing without a problem', () => {
    const { container } = render(<FormProblems title="x" problem={null} notReady={[]} />);
    expect(container.textContent).toBe('');
    expect(formProblemCount(null, [])).toBe(0);
    expect(formProblemCount('board_missing', [{ kind: 'no_questions' }])).toBe(2);
  });
});

describe('FormStatusBar problems', () => {
  const link = { status: 'ready', link: { link: null, responses: 3 } } as unknown as FormLinkState;
  const bar = (canEdit: boolean, problems: number, onProblems = vi.fn()) => {
    render(
      <FormStatusBar
        link={link}
        problem={null}
        canEdit={canEdit}
        onFix={() => {}}
        problems={problems}
        onProblems={onProblems}
      />,
    );
    return onProblems;
  };

  it('offers an Editor Problems with this Form, opening Share Form', () => {
    const open = bar(true, 2);
    fireEvent.click(screen.getByRole('button', { name: /Problems with this Form/ }));
    expect(open).toHaveBeenCalledOnce();
  });

  it('says nothing with no problems, or to someone who may not edit', () => {
    bar(true, 0);
    expect(screen.queryByRole('button', { name: /Problems with this Form/ })).toBeNull();
    cleanup();
    bar(false, 2);
    expect(screen.queryByRole('button', { name: /Problems with this Form/ })).toBeNull();
  });
});
