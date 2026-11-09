// @vitest-environment jsdom
// The message popover (docs/specs/008-canvas/avatar-mode.md "The message popover"): the
// app's standard text field, Cancel then Send right-aligned, and the host's own header and edges when it gives them.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvatarMessagePopover } from './AvatarMessagePopover';

afterEach(cleanup);

const popover = (over: Partial<Parameters<typeof AvatarMessagePopover>[0]> = {}) => {
  const onSend = vi.fn(() => true);
  const onCancel = vi.fn();
  render(
    <AvatarMessagePopover coolingDown={false} onSend={onSend} onCancel={onCancel} {...over} />,
  );
  return { onSend, onCancel };
};

describe('AvatarMessagePopover', () => {
  it('draws the message as the shared text field (its border and focus ring), focused', () => {
    popover();
    const box = screen.getByRole('textbox', { name: 'Message' });
    expect(box.className).toContain('focus:ring-2');
    expect(box.className).toContain('rounded-md');
    expect(document.activeElement).toBe(box);
  });

  it('puts Cancel before Send, Send greyed while blank', () => {
    popover();
    const buttons = screen.getAllByRole('button').map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['Cancel', 'Send']);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Send' }).disabled).toBe(true);
  });

  it('sends, and clears the field once it went', () => {
    const { onSend } = popover();
    const box = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'hello room' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('hello room');
    expect(box.value).toBe('');
  });

  it('holds Send while cooling down, and says so', () => {
    popover({ coolingDown: true });
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'again' },
    });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Send' }).disabled).toBe(true);
    expect(screen.getByText('One moment…')).toBeTruthy();
  });

  it('Cancel cancels', () => {
    const { onCancel, onSend } = popover();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("takes the host's header in place of its own title, and the host's edges", () => {
    popover({
      header: <header>Say Something</header>,
      bodyClassName: 'p-3',
      footerClassName: 'footer-bar',
    });
    expect(screen.getByText('Say Something')).toBeTruthy();
    expect(screen.queryByText('Send a Message')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send' }).parentElement?.className).toContain(
      'footer-bar',
    );
  });

  it('names itself with its small title without a header', () => {
    popover();
    expect(screen.getByText('Send a Message')).toBeTruthy();
  });
});
