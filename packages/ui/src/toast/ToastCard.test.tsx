// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastCard, toastCardLayout } from './ToastCard';

afterEach(cleanup);

// liveworkspace/docs/specs/016-notifications/toasts.md "One line by default" and "Look".
describe('ToastCard', () => {
  it('reads icon, message, actions, close, in that order, on one wrapping row', () => {
    render(
      <ToastCard
        tone="info"
        message="File deleted"
        actions={[
          {
            label: 'Undo',
            ariaLabel: 'Undo: restore the file',
            onSelect: () => {},
            primary: true,
          },
        ]}
        onClose={() => {}}
      />,
    );
    const card = screen.getByRole('status');
    expect(card.getAttribute('data-toast-layout')).toBe('inline');
    const [icon, body, close] = Array.from(card.children);
    expect(icon!.getAttribute('aria-hidden')).toBe('true');
    // The close, in its tooltip's `contents` wrapper, ends the row.
    expect(close!.querySelector('button')!.getAttribute('aria-label')).toBe('Dismiss');
    // The message and the actions share one wrapping row; the message's basis is its own width.
    expect(body!.className).toContain('flex-wrap');
    const [message, actions] = Array.from(body!.children);
    expect(message!.textContent).toBe('File deleted');
    expect(message!.className).toContain('flex-[1_1_10rem]');
    expect(actions!.className).toContain('ml-auto');
    expect(actions!.textContent).toBe('Undo');
  });

  it('draws the highlight look: solid emerald, white text, a white primary and a light close', () => {
    const { rerender } = render(
      <ToastCard
        tone="info"
        message="Sign in"
        onClose={() => {}}
        actions={[
          { label: 'Later', onSelect: () => {} },
          { label: 'Sign In', onSelect: () => {}, primary: true },
        ]}
        highlight
      />,
    );
    const card = screen.getByRole('status');
    expect(card.hasAttribute('data-toast-highlight')).toBe(true);
    expect(card.className).toContain('bg-emerald-700');
    expect(card.className).not.toContain('bg-white ');
    expect(screen.getByRole('button', { name: 'Sign In' }).className).toContain('text-emerald-800');
    expect(screen.getByRole('button', { name: 'Later' }).className).toContain('text-white/90');
    expect(screen.getByRole('button', { name: 'Dismiss' }).className).toContain('text-white/80');
    rerender(<ToastCard tone="info" message="Sign in" onClose={() => {}} />);
    expect(screen.getByRole('status').hasAttribute('data-toast-highlight')).toBe(false);
    expect(screen.getByRole('button', { name: 'Dismiss' }).className).toContain('text-slate-400');
  });

  it('runs an action, and leaves a disabled one alone', () => {
    const run = vi.fn();
    const busy = vi.fn();
    render(
      <ToastCard
        tone="info"
        message="Webber changed 3 elements"
        actions={[
          { label: 'Show', onSelect: busy, disabled: true },
          { label: 'Undo', onSelect: run, primary: true },
        ]}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(busy).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('draws a destructive answer in rose, never the brand colour', () => {
    render(
      <ToastCard
        tone="info"
        message="This image isn't used anywhere else. Delete it from storage? It can't be undone."
        actions={[
          { label: 'Keep', onSelect: () => {} },
          { label: 'Delete from Storage', onSelect: () => {}, primary: true, destructive: true },
        ]}
        onClose={() => {}}
      />,
    );
    const remove = screen.getByRole('button', { name: 'Delete from Storage' });
    expect(remove.hasAttribute('data-toast-destructive')).toBe(true);
    expect(remove.className).toContain('text-rose-700');
    expect(remove.className).not.toContain('text-brand-700');
    const keep = screen.getByRole('button', { name: 'Keep' });
    expect(keep.hasAttribute('data-toast-destructive')).toBe(false);
  });

  // toasts.md "A switch on a toast".
  it('carries one switch under the message that flips without answering or closing', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    const keep = vi.fn();
    const toggle = { label: 'Remember My Choice', onChange };
    const { rerender } = render(
      <ToastCard
        tone="info"
        message="This image isn't used anywhere else."
        actions={[{ label: 'Keep', onSelect: keep }]}
        toggle={toggle}
        onClose={onClose}
      />,
    );
    const remember = screen.getByRole('switch', { name: 'Remember My Choice' });
    expect(remember.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(remember);
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(remember.getAttribute('aria-checked')).toBe('true');
    expect(keep).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // The same toggle on a re-render keeps where it was put; a newer one starts again.
    rerender(<ToastCard tone="info" message="Still here" toggle={toggle} onClose={onClose} />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
    rerender(
      <ToastCard
        tone="info"
        message="A newer delete"
        toggle={{ label: 'Remember My Choice', onChange }}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });

  it('has no switch unless given one', () => {
    render(<ToastCard tone="info" message="Moved" onClose={() => {}} />);
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('is an alert for an error, and tints its border for a problem only', () => {
    const { rerender } = render(
      <ToastCard tone="error" message="Couldn't save." onClose={() => {}} />,
    );
    expect(screen.getByRole('alert').className).toContain('border-rose-200');
    rerender(<ToastCard tone="warning" message="Showing this browser only." onClose={() => {}} />);
    expect(screen.getByRole('status').className).toContain('border-amber-200');
    rerender(<ToastCard tone="success" message="Saved" onClose={() => {}} />);
    expect(screen.getByRole('status').className).toContain('border-slate-200');
  });

  it('enters with toast-in and leaves with toast-out, taking no presses while it goes', () => {
    const { rerender } = render(<ToastCard tone="info" message="Moved" onClose={() => {}} />);
    expect(screen.getByRole('status').className).toContain('animate-toast-in');
    rerender(<ToastCard tone="info" message="Moved" onClose={() => {}} leaving />);
    expect(screen.getByRole('status').className).toContain('animate-toast-out');
    expect(screen.getByRole('status').className).toContain('pointer-events-none');
  });

  it('enters with the bolder toast-in-full when it arrives on a full stack', () => {
    render(<ToastCard tone="info" message="Deleted" onClose={() => {}} full />);
    const cls = screen.getByRole('status').className;
    expect(cls).toContain('animate-toast-in-full');
    expect(cls).toContain('pointer-events-auto');
  });

  // toasts.md "One line by default, stacked when there is more to say".
  it('keeps a plain toast on one row, and stacks one with more to say', () => {
    const undo = [{ label: 'Undo', onSelect: () => {}, primary: true }];
    expect(toastCardLayout({ actions: undo })).toBe('inline');
    expect(toastCardLayout({ title: null, body: false, actions: [] })).toBe('inline');
    expect(toastCardLayout({ title: 'Make These a Plan' })).toBe('stacked');
    expect(toastCardLayout({ body: <p>rows</p> })).toBe('stacked');
    expect(toastCardLayout({ toggle: { label: 'Remember', onChange: () => {} } })).toBe('stacked');
    expect(
      toastCardLayout({ actions: [{ label: 'Don’t Suggest This Again', quiet: true }, ...undo] }),
    ).toBe('stacked');
  });

  it('stacks: the title and close first, the words at full width, the actions on a foot row', () => {
    const never = vi.fn();
    const take = vi.fn();
    render(
      <ToastCard
        tone="info"
        title="Make These a Plan"
        message="3 action stickies here could be cards in a liveplanner plan, one each."
        actions={[
          { label: 'Don’t Suggest This Again', onSelect: never, quiet: true },
          { label: 'Send to Plan', onSelect: take, primary: true },
        ]}
        onClose={() => {}}
      />,
    );
    const card = screen.getByRole('status');
    expect(card.getAttribute('data-toast-layout')).toBe('stacked');
    expect(card.className).toContain('sm:w-[25rem]');
    const column = card.children[1]!;
    // The close floats in the first line's corner, so only the title's line runs short of it.
    const close = screen.getByRole('button', { name: 'Dismiss' });
    expect(close.className).toContain('float-right');
    expect(column.firstElementChild!.contains(close)).toBe(true);
    const title = column.querySelector('[data-toast-title]')!;
    const message = column.querySelector('[data-toast-message]')!;
    const foot = column.querySelector('[data-toast-foot]')!;
    expect(title.textContent).toBe('Make These a Plan');
    expect(message.textContent).toContain('3 action stickies');
    // Top to bottom: title, message, then the foot row last, clear of the float.
    expect(title.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(foot).toBe(column.lastElementChild);
    expect(foot.className).toContain('clear-both');
    // The quiet answer at the foot's start, the primary a solid button at its end.
    const quiet = screen.getByRole('button', { name: 'Don’t Suggest This Again' });
    expect(quiet.hasAttribute('data-toast-quiet')).toBe(true);
    expect(quiet.parentElement!.className).toContain('mr-auto');
    const send = screen.getByRole('button', { name: 'Send to Plan' });
    expect(send).toBe(foot.lastElementChild);
    expect(send.className).toContain('bg-brand-700');
    expect(send.className).toContain('text-white');
    fireEvent.click(quiet);
    fireEvent.click(send);
    expect(never).toHaveBeenCalledTimes(1);
    expect(take).toHaveBeenCalledTimes(1);
  });

  it('stacks a switch, its answers on the foot row under it; a destructive primary is solid rose', () => {
    render(
      <ToastCard
        tone="info"
        message="This image isn't used anywhere else. Delete it from storage? It can't be undone."
        actions={[
          { label: 'Keep', onSelect: () => {} },
          { label: 'Delete from Storage', onSelect: () => {}, primary: true, destructive: true },
        ]}
        toggle={{ label: 'Remember My Choice', onChange: () => {} }}
        onClose={() => {}}
      />,
    );
    const card = screen.getByRole('status');
    expect(card.getAttribute('data-toast-layout')).toBe('stacked');
    const toggle = card.querySelector('[data-toast-toggle]')!;
    const foot = card.querySelector('[data-toast-foot]')!;
    expect(toggle.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const remove = screen.getByRole('button', { name: 'Delete from Storage' });
    expect(remove.className).toContain('bg-rose-700');
    expect(screen.getByRole('button', { name: 'Keep' }).className).toContain('text-slate-600');
  });

  it('draws a link for an action with href, a given icon and role, and no close without onClose', () => {
    const follow = vi.fn();
    render(
      <ToastCard
        tone="info"
        role="group"
        aria-label="Inbox notice"
        icon={<svg data-testid="kind" />}
        title="Priya mentioned you"
        body={<p>Roadmap</p>}
        actions={[
          { label: 'Open in Inbox', href: '/explorer/inbox?at=1', onSelect: follow, primary: true },
        ]}
      />,
    );
    const card = screen.getByRole('group', { name: 'Inbox notice' });
    expect(card.querySelector('[data-testid=kind]')).not.toBeNull();
    const link = screen.getByRole('link', { name: 'Open in Inbox' });
    expect(link.getAttribute('href')).toBe('/explorer/inbox?at=1');
    expect(link.className).toContain('bg-brand-700');
    link.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(link);
    expect(follow).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('keeps a plain toast inline when told, and draws the highlight quiet answer light', () => {
    render(
      <ToastCard
        tone="info"
        layout="inline"
        message="Saved"
        highlight
        actions={[{ label: 'Not Now', onSelect: () => {}, quiet: true }]}
      />,
    );
    expect(screen.getByRole('status').getAttribute('data-toast-layout')).toBe('inline');
    expect(screen.getByRole('button', { name: 'Not Now' }).className).toContain('text-white/85');
  });
});
