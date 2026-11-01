// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// livehuddle's binding of the shared Delete Account dialog (@liveworkspace/workbench, tested there in full): its name, its
// api's code and delete, and the telemetry counter.
const calls = vi.hoisted(() => [] as string[]);
vi.mock('@liveworkspace/workbench/components/providers/deferred-auth', () => ({
  useDeferredAuth: () => ({
    user: { email: 'a@example.com' },
    deleteAccount: async () => void calls.push('session'),
  }),
}));
vi.mock('@/lib/api-client', () => ({
  apiSendDeletionCode: async () => {
    calls.push('code');
    return 'sent';
  },
  apiDeleteAccount: async (code: string) => {
    calls.push(`delete ${code}`);
    return 'deleted';
  },
}));
vi.mock('@/lib/telemetry', () => ({ track: (...args: string[]) => calls.push(args.join(' ')) }));

import { DeleteAccountDialog } from './DeleteAccountDialog';

describe('DeleteAccountDialog', () => {
  it('names livehuddle, emails a code, and deletes with it', async () => {
    const onDeleted = vi.fn();
    render(<DeleteAccountDialog open onClose={() => {}} onDeleted={onDeleted} />);
    expect(screen.getByText(/not just livehuddle/)).toBeTruthy();
    expect(screen.getByText(/Canvases in This Browser stay on this device/)).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Email Me a Code' }));
    const first = await screen.findByRole('textbox', { name: 'Digit 1' });
    fireEvent.paste(first, { clipboardData: { getData: () => '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(calls).toEqual(['code', 'delete 123456', 'Session Deleted Account', 'session']);
  });
});
