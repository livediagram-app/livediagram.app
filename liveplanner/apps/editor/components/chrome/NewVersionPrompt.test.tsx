// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROJECT_FORMAT } from '@liveplanner/api-schema';
import {
  EDITOR_BUILD_ID,
  noteServerProjectFormat,
  resetServerReleaseForTests,
} from '@/lib/server-release';
import { NewVersionPrompt } from './NewVersionPrompt';

// docs/specs/016-platform/new-version-prompt.md: this editor's binding of the shared prompt, whose
// states, build check, copy and telemetry are pinned by
// packages/workbench/src/components/chrome/NewVersionPrompt.test.tsx.
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  resetServerReleaseForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('NewVersionPrompt', () => {
  it('follows this editor’s format number and store, with its name in the copy', async () => {
    // Tests build without a build id, as local development does: the prompt shows with no request.
    expect(EDITOR_BUILD_ID).toBeNull();
    const reload = vi.fn();
    const { container } = render(
      <NewVersionPrompt hasUnsavedChanges={() => false} reload={reload} />,
    );
    act(() => noteServerProjectFormat(PROJECT_FORMAT));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(container.innerHTML).toBe('');
    act(() => noteServerProjectFormat(PROJECT_FORMAT + 1));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByRole('status').textContent).toContain(
      'A new version of liveplanner is ready.',
    );
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reload' })));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
