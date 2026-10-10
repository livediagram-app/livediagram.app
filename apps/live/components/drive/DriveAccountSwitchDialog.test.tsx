// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/core';
import {
  ACCOUNT_SWITCH_BODY,
  ACCOUNT_SWITCH_EXPIRED,
  ACCOUNT_SWITCH_FAILED,
  DriveAccountSwitchDialog,
} from './DriveAccountSwitchDialog';

// docs/specs/022-drive-mirror/blueprints/drive-mirror.md "Account switch dialog".

afterEach(cleanup);

function setup(over: { onSwitch?: () => Promise<void>; onKeep?: () => Promise<void> } = {}) {
  const onSwitch = vi.fn(over.onSwitch ?? (async () => {}));
  const onKeep = vi.fn(over.onKeep ?? (async () => {}));
  render(
    <DriveAccountSwitchDialog onSwitch={onSwitch} onKeep={onKeep} cloudSyncHref="/explorer" />,
  );
  return { onSwitch, onKeep };
}

describe('DriveAccountSwitchDialog', () => {
  it('asks in Title Case, explains the move, and focuses Switch Account', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Switch Google Account?' })).toBeTruthy();
    expect(screen.getByText(ACCOUNT_SWITCH_BODY)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Switch Account' }));
  });

  it('Switch Account confirms, and both buttons wait while it runs', async () => {
    let finish!: () => void;
    const { onSwitch, onKeep } = setup({
      onSwitch: () => new Promise<void>((r) => (finish = r)),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Switch Account' }));
    expect(onSwitch).toHaveBeenCalledTimes(1);
    const busy = screen.getByRole('button', { name: 'Switching…' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Keep Current Account' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    finish();
    expect(onKeep).not.toHaveBeenCalled();
  });

  it('Keep Current Account cancels', () => {
    const { onSwitch, onKeep } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Keep Current Account' }));
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it('an expired switch says so and offers only Back to Cloud Sync', async () => {
    setup({
      onSwitch: async () => {
        throw new ApiError('drive account switch', 409, 'drive_account_switch_expired');
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Switch Account' }));
    await waitFor(() => expect(screen.getByText(ACCOUNT_SWITCH_EXPIRED)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Back to Cloud Sync' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Switch Account' })).toBeNull();
  });

  it('any other failure keeps both choices with an alert', async () => {
    setup({
      onKeep: async () => {
        throw new ApiError('drive account switch cancel', 500, null);
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Keep Current Account' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(ACCOUNT_SWITCH_FAILED));
    expect(
      (screen.getByRole('button', { name: 'Switch Account' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
