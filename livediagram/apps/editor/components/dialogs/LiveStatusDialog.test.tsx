// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveStatusDialog } from './LiveStatusDialog';
import { STATUS_URL_INVALID, STATUS_URL_PRIVATE } from '@/lib/live-status-input';

// docs/specs/009-elements/live-status.md "The Live Status dialog".

afterEach(cleanup);

const URL_A = 'https://status.example.com/api/v2/status.json';

function open(over: Partial<Parameters<typeof LiveStatusDialog>[0]> = {}) {
  const props = {
    url: undefined,
    status: undefined,
    now: 0,
    onSave: vi.fn(),
    onRemove: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<LiveStatusDialog {...props} />);
  return props;
}

const field = () => screen.getByLabelText<HTMLInputElement>('Status URL');
const save = () => screen.getByRole('button', { name: 'Save' });

describe('LiveStatusDialog', () => {
  it('refuses as typed and keeps Save off until the address passes', () => {
    open();
    expect(save()).toHaveProperty('disabled', true);
    fireEvent.change(field(), { target: { value: 'http://status.example.com' } });
    expect(screen.getByText(STATUS_URL_INVALID)).toBeTruthy();
    expect(field().getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(field(), { target: { value: 'https://10.0.0.1/' } });
    expect(screen.getByText(STATUS_URL_PRIVATE)).toBeTruthy();
    expect(save()).toHaveProperty('disabled', true);
    fireEvent.change(field(), { target: { value: 'status.example.com/api/v2/status.json' } });
    expect(save()).toHaveProperty('disabled', false);
    expect(screen.getByText(/never put a key or token in it/)).toBeTruthy();
  });

  it('saves the parsed address and closes; offers no Remove when unbound', () => {
    const p = open();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    fireEvent.change(field(), { target: { value: ' status.example.com/api/v2/status.json ' } });
    fireEvent.click(save());
    expect(p.onSave).toHaveBeenCalledWith(URL_A);
    expect(p.onClose).toHaveBeenCalled();
  });

  it('saves on Enter, never a refused address', () => {
    const p = open();
    fireEvent.change(field(), { target: { value: 'localhost' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(p.onSave).not.toHaveBeenCalled();
    fireEvent.change(field(), { target: { value: URL_A } });
    fireEvent.keyDown(field(), { key: 'a' });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(p.onSave).toHaveBeenCalledWith(URL_A);
  });

  it('writes nothing when the address did not change', () => {
    const p = open({ url: URL_A });
    fireEvent.click(save());
    expect(p.onSave).not.toHaveBeenCalled();
    expect(p.onClose).toHaveBeenCalled();
  });

  it('shows the bound state now, and removes the binding', () => {
    const p = open({
      url: URL_A,
      status: { state: 'down', checkedAt: 0, reason: 'timeout' },
      now: 40_000,
    });
    expect(screen.getByRole('img', { name: 'Live status: Down' })).toBeTruthy();
    expect(screen.getByText(/No answer in 5 seconds · Checked 40 seconds ago/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(p.onRemove).toHaveBeenCalled();
    expect(p.onClose).toHaveBeenCalled();
  });

  it('cancels without a write', () => {
    const p = open({ url: URL_A });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(p.onSave).not.toHaveBeenCalled();
    expect(p.onRemove).not.toHaveBeenCalled();
    expect(p.onClose).toHaveBeenCalled();
  });
});
