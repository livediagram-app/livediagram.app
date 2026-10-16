// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FormLinkState } from '@/hooks/forms/useFormLink';
import { ShareFormDialog } from './ShareFormDialog';

// Share Form before publishing (docs/specs/030-forms/forms.md "Publishing and the form link"): Publish Form held back
// while responses have nowhere to go or the form is not ready, each problem said.

afterEach(cleanup);

const link = (over: Partial<FormLinkState> = {}): FormLinkState => ({
  link: { link: null, responses: 0, unseen: 0, suspendedAt: null, canPublish: true },
  status: 'ready',
  busy: false,
  error: null,
  publish: vi.fn(async () => true),
  setOpen: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
  reload: vi.fn(),
  ...over,
});

const publishButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Publish Form' });

describe('Share Form, unpublished', () => {
  it('publishes a form that is ready', () => {
    const l = link();
    render(
      <ShareFormDialog
        open
        onClose={() => {}}
        link={l}
        problem={null}
        onFixDestination={() => {}}
      />,
    );
    fireEvent.click(publishButton());
    expect(l.publish).toHaveBeenCalled();
  });

  it('lists what stops publishing, each with Show but the form-wide one', () => {
    const onShow = vi.fn();
    render(
      <ShareFormDialog
        open
        onClose={() => {}}
        link={link()}
        problem={null}
        onFixDestination={() => {}}
        notReady={[{ kind: 'no_questions' }, { kind: 'unworded', questionId: 'q-1' }]}
        onShow={onShow}
      />,
    );
    expect(publishButton().disabled).toBe(true);
    expect(screen.getByText('Add a question: a form needs at least one.')).toBeTruthy();
    const shows = screen.getAllByRole('button', { name: 'Show' });
    expect(shows).toHaveLength(1);
    fireEvent.click(shows[0]!);
    expect(onShow).toHaveBeenCalledWith({ kind: 'unworded', questionId: 'q-1' });
  });

  it('says first when responses have nowhere to go', () => {
    const fix = vi.fn();
    render(
      <ShareFormDialog
        open
        onClose={() => {}}
        link={link()}
        problem="board_missing"
        onFixDestination={fix}
        notReady={[{ kind: 'no_questions' }]}
      />,
    );
    expect(publishButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Choose Where Responses Go' }));
    expect(fix).toHaveBeenCalled();
  });
});

describe('Share Form, published and closed (forms.md "A live form is locked")', () => {
  const closed = (): FormLinkState =>
    link({
      link: {
        link: { code: 'abc', open: false, createdAt: 1 },
        responses: 3,
        unseen: 0,
        suspendedAt: null,
        canPublish: true,
      },
    });
  const accepting = () =>
    screen.getByRole<HTMLButtonElement>('switch', { name: /Accepting Responses/ });

  it('holds Accepting Responses off while the form has problems', () => {
    const l = closed();
    render(
      <ShareFormDialog
        open
        onClose={() => {}}
        link={l}
        problem={null}
        onFixDestination={() => {}}
        notReady={[{ kind: 'unworded', questionId: 'q-1' }]}
      />,
    );
    expect(accepting().disabled).toBe(true);
    expect(screen.getByText('Closed until the problems below are fixed.')).toBeTruthy();
    fireEvent.click(accepting());
    expect(l.setOpen).not.toHaveBeenCalled();
  });

  it('opens it again once nothing stops it', () => {
    const l = closed();
    render(
      <ShareFormDialog
        open
        onClose={() => {}}
        link={l}
        problem={null}
        onFixDestination={() => {}}
      />,
    );
    fireEvent.click(accepting());
    expect(l.setOpen).toHaveBeenCalledWith(true);
  });
});
