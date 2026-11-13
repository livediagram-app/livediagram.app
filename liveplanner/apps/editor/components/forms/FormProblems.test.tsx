// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PublishProblem } from '@liveplanner/forms';
import { setFormProblemsHost } from '@/lib/form-problems-store';
import { FormProblems, formProblemCount } from './FormProblems';
import { FormProblemsButton } from './FormProblemsButton';

// A form's problems (docs/specs/030-forms/forms.md "Publishing and the form link"): every one listed together, and the
// bottom-right cluster's Problems, an Editor's, listing them in its popover.

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

describe('FormProblemsButton', () => {
  const host = (notReady: PublishProblem[]) =>
    setFormProblemsHost({
      problem: null,
      notReady,
      warnings: [],
      onFixDestination: vi.fn(),
      onShow: vi.fn(),
    });

  it('offers Problems while the open form has any, its popover listing them', () => {
    act(() => host([{ kind: 'no_questions' }]));
    render(<FormProblemsButton />);
    fireEvent.click(screen.getByRole('button', { name: /Problems with this Form: 1/ }));
    expect(screen.getByText('Problems with this Form', { selector: 'p' })).toBeTruthy();
    act(() => setFormProblemsHost(null));
  });

  it('says nothing with no problems, or with no Form page open', () => {
    act(() => host([]));
    const { container } = render(<FormProblemsButton />);
    expect(container.textContent).toBe('');
    act(() => setFormProblemsHost(null));
    expect(container.textContent).toBe('');
  });
});

// Problems with this Form (docs/specs/030-forms/forms.md "Columns follow the card type"): a warning is listed with
// the problems, with its fix, and counted only where it is given.

describe('FormProblems with a warning', () => {
  it('lists the warning with Choose Where Responses Go', () => {
    const fix = vi.fn();
    render(
      <FormProblems
        title="Problems with this Form"
        problem={null}
        notReady={[]}
        warnings={['Its column isn’t one of Work Item’s states.']}
        onFixDestination={fix}
      />,
    );
    expect(screen.getByText('Its column isn’t one of Work Item’s states.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Choose Where Responses Go' }));
    expect(fix).toHaveBeenCalledTimes(1);
  });

  it('draws nothing with nothing to list, and counts warnings only when given', () => {
    const { container } = render(<FormProblems title="T" problem={null} notReady={[]} />);
    expect(container.textContent).toBe('');
    expect(formProblemCount(null, [])).toBe(0);
    expect(formProblemCount('no_destination', [], ['w'])).toBe(2);
  });

  it('lists a warning without a fix when none is offered', () => {
    render(<FormProblems title="T" problem={null} notReady={[]} warnings={['w']} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
