// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_FORMAT } from '@livediagram/api-schema';
import { noteServerDocumentFormat, resetServerReleaseForTests } from '@/lib/server-release';
import { RELOAD_SAVE_WAIT_MS } from '@/lib/reload-when-saved';

const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => track(...a) }));

const { NewVersionPrompt } = await import('./NewVersionPrompt');

// docs/specs/016-platform/new-version-prompt.md "The prompt".
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  track.mockClear();
});
afterEach(() => {
  resetServerReleaseForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const newer = () => act(() => noteServerDocumentFormat(DOCUMENT_FORMAT + 1));

describe('NewVersionPrompt', () => {
  it('shows nothing while the server is not ahead', () => {
    const { container } = render(
      <NewVersionPrompt hasUnsavedChanges={() => false} reload={vi.fn()} />,
    );
    act(() => noteServerDocumentFormat(DOCUMENT_FORMAT));
    expect(container.innerHTML).toBe('');
  });

  it('offers a reload as a polite status, without taking focus, once', () => {
    render(<NewVersionPrompt hasUnsavedChanges={() => false} reload={vi.fn()} />);
    newer();
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('A new version of livediagram is ready.');
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Reload' }));
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'NewVersionPrompt');
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('shows at once when the newer number arrived before it mounted', () => {
    noteServerDocumentFormat(DOCUMENT_FORMAT + 1);
    render(<NewVersionPrompt hasUnsavedChanges={() => false} reload={vi.fn()} />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('reloads at once when everything is saved', async () => {
    const reload = vi.fn();
    render(<NewVersionPrompt hasUnsavedChanges={() => false} reload={reload} />);
    newer();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reload' })));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'NewVersionPrompt');
  });

  it('saves first, then reloads', async () => {
    const reload = vi.fn();
    let unsaved = true;
    render(<NewVersionPrompt hasUnsavedChanges={() => unsaved} reload={reload} />);
    newer();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reload' })));
    expect(screen.getByRole('status').textContent).toContain('Saving your changes…');
    expect((screen.getByRole('button', { name: 'Reload' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(reload).not.toHaveBeenCalled();
    unsaved = false;
    await act(async () => vi.advanceTimersByTimeAsync(400));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads over unsaved changes, and says why', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reload = vi.fn();
    render(<NewVersionPrompt hasUnsavedChanges={() => true} reload={reload} />);
    newer();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reload' })));
    await act(async () => vi.advanceTimersByTimeAsync(RELOAD_SAVE_WAIT_MS + 400));
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain(
      "Your latest changes aren't saved yet. Reload once they are.",
    );
    expect((screen.getByRole('button', { name: 'Reload' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('hides on Not now until a still newer number arrives', () => {
    render(<NewVersionPrompt hasUnsavedChanges={() => false} reload={vi.fn()} />);
    newer();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('status')).toBeNull();
    act(() => noteServerDocumentFormat(DOCUMENT_FORMAT + 1));
    expect(screen.queryByRole('status')).toBeNull();
    act(() => noteServerDocumentFormat(DOCUMENT_FORMAT + 2));
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
