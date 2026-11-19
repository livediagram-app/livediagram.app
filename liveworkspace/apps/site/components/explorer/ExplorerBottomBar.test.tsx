// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOAST_BELL_ATTR, TOAST_FLOOR_SELECTOR } from '@liveworkspace/ui/toast';
import { ExplorerBottomBar } from './ExplorerBottomBar';

// The Explorer's bottom bar holds the notification bell to the right of Settings, and the toast stack stands on it
// (liveworkspace/docs/specs/016-notifications/toasts.md "The footer button" and "Placement").

afterEach(cleanup);

describe('ExplorerBottomBar', () => {
  it('is a floor the toasts stand on, with the bell after Settings', () => {
    const { container } = render(
      <ExplorerBottomBar
        appName={null}
        onOpenSearch={vi.fn()}
        onPrepareSearch={vi.fn()}
        settingsHref="/settings"
      />,
    );
    const bar = container.querySelector('[data-explorer-bottom-bar]')!;
    expect(bar.matches(TOAST_FLOOR_SELECTOR)).toBe(true);
    const bell = screen.getByRole('button', { name: 'Notifications' });
    expect(bell.hasAttribute(TOAST_BELL_ATTR)).toBe(true);
    const settings = screen.getByRole('link', { name: /Settings/ });
    expect(settings.compareDocumentPosition(bell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
