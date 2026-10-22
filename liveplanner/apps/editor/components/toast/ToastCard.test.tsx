// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastCard } from './ToastCard';

afterEach(cleanup);

// docs/specs/004-interface-design/toasts.md "One line by default" and "Look".
describe('ToastCard', () => {
  it('reads icon, message, actions, close, in that order, on one wrapping row', () => {
    render(
      <ToastCard
        tone="info"
        message="Project deleted"
        actions={[
          {
            label: 'Undo',
            ariaLabel: 'Undo: restore the project',
            onSelect: () => {},
            primary: true,
          },
        ]}
        onClose={() => {}}
      />,
    );
    const card = screen.getByRole('status');
    const [icon, body, close] = Array.from(card.children);
    expect(icon!.getAttribute('aria-hidden')).toBe('true');
    expect(close!.getAttribute('aria-label')).toBe('Dismiss');
    // The message and the actions share one wrapping row; the message's basis is its own width.
    expect(body!.className).toContain('flex-wrap');
    const [message, actions] = Array.from(body!.children);
    expect(message!.textContent).toBe('Project deleted');
    expect(message!.className).toContain('flex-[1_1_auto]');
    expect(actions!.className).toContain('ml-auto');
    expect(actions!.textContent).toBe('Undo');
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
});
