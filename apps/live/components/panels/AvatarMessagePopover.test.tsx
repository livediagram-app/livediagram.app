// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { stubResizeObserver } from '@/components/sheets/sheet-ui-test-utils';
import { DEFAULT_AVATAR_CONFIG } from '@/lib/avatar-config';
import { AvatarClusterButton } from '@/components/canvas/AvatarClusterButton';
import { AvatarPanel } from './AvatarPanel';

beforeAll(stubResizeObserver);
afterEach(cleanup);

const panel = (onSendMessage?: (text: string) => boolean) =>
  render(
    <AvatarPanel
      config={DEFAULT_AVATAR_CONFIG}
      onChange={() => {}}
      onRandomise={() => {}}
      onReaction={() => {}}
      onSendMessage={onSendMessage}
      position={null}
      onMoveTo={() => {}}
    />,
  );

describe('the Avatar panel’s Send a Message (docs/specs/008-canvas/avatar-mode.md "The message popover")', () => {
  it('is not offered to someone who may not speak', () => {
    panel();
    expect(screen.queryByText('Send a Message')).toBeNull();
  });

  it('opens the message view, sends, and comes back to the panel', () => {
    const onSend = vi.fn(() => true);
    panel(onSend);
    fireEvent.click(screen.getByText('Send a Message'));
    const box = screen.getByRole('textbox', { name: 'Message' });
    const send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(box, { target: { value: 'hello room' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('hello room');
    expect(screen.queryByRole('textbox', { name: 'Message' })).toBeNull();
  });

  it('Cancel returns to the panel without sending', () => {
    const onSend = vi.fn(() => true);
    panel(onSend);
    fireEvent.click(screen.getByText('Send a Message'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText('Send a Message')).toBeTruthy();
  });

  it('refuses a keystroke past fifty words', () => {
    panel(() => true);
    fireEvent.click(screen.getByText('Send a Message'));
    const box = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    const fifty = Array.from({ length: 50 }, () => 'w').join(' ');
    fireEvent.change(box, { target: { value: fifty } });
    fireEvent.change(box, { target: { value: `${fifty} more` } });
    expect(box.value).toBe(fifty);
    expect(screen.getByText('50 / 50')).toBeTruthy();
  });
});

describe('the Avatar button', () => {
  it('opens the panel, and tells a Viewer only what they can do', () => {
    const onToggle = vi.fn();
    render(<AvatarClusterButton popoverOpen={false} onTogglePopover={onToggle} canSpeak={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Avatar/ }));
    expect(onToggle).toHaveBeenCalled();
  });
});
