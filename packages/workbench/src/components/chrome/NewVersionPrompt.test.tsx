// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORKBENCH_DEFAULTS, configureWorkbench } from '../../bindings';
import { createListeners } from '../../lib/listeners';
import { LIVE_BUILD_MAX_CHECKS, LIVE_BUILD_POLL_MS } from '../../hooks/ui/useNewerEditorLive';
import { RELOAD_SAVE_WAIT_MS } from '../../lib/reload-when-saved';
import { setStartPanelOpen } from '../start/start-panel-open';
import {
  NewVersionPrompt,
  OVER_START_SHEET,
  STILL_ARRIVING,
  type NewVersionPromptProps,
} from './NewVersionPrompt';

// docs/specs/016-platform/new-version-prompt.md "When the prompt shows" and "The prompt", in each product.
const EDITOR_FORMAT = 4;
const META = 'liveplanner-build';
const track = vi.fn();
const listeners = createListeners();
let serverFormat: number | null = null;
const noteServer = (format: number) =>
  act(() => {
    serverFormat = format;
    listeners.notify();
  });
const newer = () => noteServer(EDITOR_FORMAT + 1);

// The page the editor would reload into serves this build.
let liveBuild = 'own';
const fetchMock = vi.fn(
  async () => new Response(`<head><meta name="${META}" content="${liveBuild}"/></head>`),
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  configureWorkbench({ ...WORKBENCH_DEFAULTS, track, formatLogScope: 'project-format' });
  vi.stubGlobal('fetch', fetchMock);
  track.mockClear();
  fetchMock.mockClear();
  serverFormat = null;
  liveBuild = 'own';
});
afterEach(() => {
  configureWorkbench(WORKBENCH_DEFAULTS);
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mount(props: Partial<NewVersionPromptProps> = {}) {
  return render(
    <NewVersionPrompt
      product="liveplanner"
      editorFormat={EDITOR_FORMAT}
      serverFormat={() => serverFormat}
      subscribe={listeners.subscribe}
      buildMetaName={META}
      editorBuildId={null}
      hasUnsavedChanges={() => false}
      reload={vi.fn()}
      {...props}
    />,
  );
}
const flush = () => act(async () => vi.advanceTimersByTimeAsync(0));
const pressReload = () =>
  act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reload' })));

describe('NewVersionPrompt', () => {
  it('shows nothing while the server is not ahead', async () => {
    const { container } = mount();
    noteServer(EDITOR_FORMAT);
    await flush();
    expect(container.innerHTML).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('without a build id (local) shows at once, with no request: a polite status, never focused, once', async () => {
    mount();
    newer();
    await flush();
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('A new version of liveplanner is ready.');
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Reload' }));
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'NewVersionPrompt');
    expect(track).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Work Tracker 784: on a phone, an empty tab's start sheet (the overlay layer) hid it until a board was picked.
  it('stands over a start panel’s phone sheet while one is open, and back on the chrome layer after', async () => {
    mount();
    newer();
    await flush();
    const status = screen.getByRole('status');
    expect(status.className).toContain('z-[var(--z-chrome)]');
    expect(status.className).not.toContain('--z-overlay');
    act(() => setStartPanelOpen(true));
    for (const cls of OVER_START_SHEET.split(' ')) expect(status.classList).toContain(cls);
    // One above the overlay layer only: never as high as the canvas modal or a dialog.
    expect(OVER_START_SHEET).not.toMatch(/z-modal|z-canvas-modal|z-popover|z-toast/);
    act(() => setStartPanelOpen(false));
    expect(status.className).not.toContain('--z-overlay');
  });

  it('renders nothing in the static export, whatever the server says', () => {
    serverFormat = EDITOR_FORMAT + 1;
    const html = renderToString(
      <NewVersionPrompt
        product="liveplanner"
        editorFormat={EDITOR_FORMAT}
        serverFormat={() => serverFormat}
        subscribe={listeners.subscribe}
        buildMetaName={META}
        editorBuildId={null}
        hasUnsavedChanges={() => false}
      />,
    );
    expect(html).toBe('');
  });

  it('shows at once when the newer number arrived before it mounted', async () => {
    serverFormat = EDITOR_FORMAT + 1;
    mount();
    await flush();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('while the page still serves this build, waits (no prompt, no Opened) and shows once it changes', async () => {
    mount({ editorBuildId: 'own' });
    newer();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).toBeNull();
    expect(track).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(LIVE_BUILD_POLL_MS));
    expect(screen.queryByRole('status')).toBeNull();
    liveBuild = 'next';
    await act(async () => vi.advanceTimersByTimeAsync(LIVE_BUILD_POLL_MS));
    expect(screen.getByRole('status').textContent).toContain(
      'A new version of liveplanner is ready.',
    );
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'NewVersionPrompt');
  });

  it(`shows after ${LIVE_BUILD_MAX_CHECKS} checks of the same build, and Reload then holds`, async () => {
    const reload = vi.fn();
    mount({ editorBuildId: 'own', reload });
    newer();
    await flush();
    await act(async () =>
      vi.advanceTimersByTimeAsync(LIVE_BUILD_POLL_MS * (LIVE_BUILD_MAX_CHECKS - 1)),
    );
    expect(fetchMock).toHaveBeenCalledTimes(LIVE_BUILD_MAX_CHECKS);
    expect(screen.getByRole('status')).toBeTruthy();
    await pressReload();
    await flush();
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain(STILL_ARRIVING);
    expect(STILL_ARRIVING).toBe('The new version is still on its way. Try again in a minute.');
    expect(screen.getByRole('button', { name: 'Reload' }).hasAttribute('aria-busy')).toBe(false);
    expect(screen.getByRole('button', { name: 'Not now' }).hasAttribute('disabled')).toBe(false);
    // Once the new build is live, Reload goes through.
    liveBuild = 'next';
    await pressReload();
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads after the save and the build check when a newer build is live', async () => {
    liveBuild = 'next';
    const reload = vi.fn();
    mount({ editorBuildId: 'own', reload });
    newer();
    await flush();
    await pressReload();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'NewVersionPrompt');
  });

  it('reloads at once when everything is saved (local: no build check)', async () => {
    const reload = vi.fn();
    mount({ reload });
    newer();
    await flush();
    await pressReload();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('saves first, then reloads', async () => {
    const reload = vi.fn();
    let unsaved = true;
    mount({ reload, hasUnsavedChanges: () => unsaved });
    newer();
    await flush();
    await pressReload();
    expect(screen.getByRole('status').textContent).toContain('Saving your changes…');
    // Busy, not disabled: the keyboard stays on Reload (busy-buttons.md).
    expect(screen.getByRole('button', { name: 'Reload' }).getAttribute('aria-busy')).toBe('true');
    expect(reload).not.toHaveBeenCalled();
    unsaved = false;
    await act(async () => vi.advanceTimersByTimeAsync(400));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads over unsaved changes, and says why', async () => {
    const reload = vi.fn();
    mount({ reload, hasUnsavedChanges: () => true });
    newer();
    await flush();
    await pressReload();
    await act(async () => vi.advanceTimersByTimeAsync(RELOAD_SAVE_WAIT_MS + 400));
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain(
      "Your latest changes aren't saved yet. Reload once they are.",
    );
    expect(screen.getByRole('button', { name: 'Reload' }).hasAttribute('aria-busy')).toBe(false);
  });

  it('hides on Not now until a still newer number arrives', async () => {
    mount();
    newer();
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('status')).toBeNull();
    noteServer(EDITOR_FORMAT + 1);
    expect(screen.queryByRole('status')).toBeNull();
    noteServer(EDITOR_FORMAT + 2);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('reloads the page by default', async () => {
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload });
    render(
      <NewVersionPrompt
        product="liveplanner"
        editorFormat={EDITOR_FORMAT}
        serverFormat={() => serverFormat}
        subscribe={listeners.subscribe}
        buildMetaName={META}
        editorBuildId={null}
        hasUnsavedChanges={() => false}
      />,
    );
    newer();
    await flush();
    await pressReload();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
