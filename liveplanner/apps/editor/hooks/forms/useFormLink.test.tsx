// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerUnsavedWork } from '@liveworkspace/workbench/lib/unsaved-work';

const api = vi.hoisted(() => ({
  apiMarkFormSeen: vi.fn(),
  apiFormLink: vi.fn(),
  apiPublishForm: vi.fn(),
  apiSetFormOpen: vi.fn(),
  apiDeleteFormLink: vi.fn(),
}));
vi.mock('@/lib/api/forms', () => api);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { PUBLISH_SAVE_WAIT_MS, useFormLink } from './useFormLink';

const unpublished = { link: null, responses: 0 };
const published = { link: { open: true }, responses: 0 };

function mount() {
  return renderHook(() =>
    useFormLink({ projectId: 'p1', tabId: 't1', ownerId: 'o1', share: null, enabled: true }),
  );
}

// forms.md "Publishing and the form link": the api checks the stored form, so Publish Form waits for this page's
// pending save; publishing straight after wording a question was refused as unworded, with nothing listed to fix.
describe('Publish Form and the pending save', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.apiMarkFormSeen.mockResolvedValue(unpublished);
    api.apiPublishForm.mockResolvedValue(published);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('publishes only once the save has landed', async () => {
    let saving = true;
    const off = registerUnsavedWork(() => saving);
    const view = mount();
    let done: Promise<boolean> = Promise.resolve(false);
    act(() => {
      done = view.result.current.publish();
    });
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(api.apiPublishForm).not.toHaveBeenCalled();
    saving = false;
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(api.apiPublishForm).toHaveBeenCalledTimes(1);
    await expect(done).resolves.toBe(true);
    off();
  });

  it('publishes straight away with nothing unsaved', async () => {
    const view = mount();
    await act(async () => {
      await view.result.current.publish();
    });
    expect(api.apiPublishForm).toHaveBeenCalledTimes(1);
  });

  it('goes anyway once the wait runs out', async () => {
    const off = registerUnsavedWork(() => true);
    const view = mount();
    act(() => {
      void view.result.current.publish();
    });
    await act(() => vi.advanceTimersByTimeAsync(PUBLISH_SAVE_WAIT_MS - 200));
    expect(api.apiPublishForm).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(api.apiPublishForm).toHaveBeenCalledTimes(1);
    off();
  });
});
