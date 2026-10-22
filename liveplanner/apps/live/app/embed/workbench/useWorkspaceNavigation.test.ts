// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const create = vi.hoisted(() => ({ createProjectInPlace: vi.fn() }));
vi.mock('./create-in-place', async (original) => ({
  ...(await original<typeof import('./create-in-place')>()),
  createProjectInPlace: create.createProjectInPlace,
}));

import { assignAppLocation } from '@/lib/app-location';
import type { WorkspacePlace } from '@/lib/workbench/workspace-place';
import { useWorkspaceNavigation } from './useWorkspaceNavigation';

// How a workspace frame moves (docs/specs/013-workspace/blueprints/workbench-embeds.md "The workspace frame"):
// every navigation becomes a move of its own, the wizard becomes New project in place, the rest a new tab.

const HOME: WorkspacePlace = { kind: 'explorer', node: { kind: 'home' } };
const path = () => `${window.location.pathname}${window.location.search}`;

let root: HTMLDivElement;
let onCreateFailed: Mock<() => void>;

function mount(place: WorkspacePlace = HOME) {
  return renderHook(() =>
    useWorkspaceNavigation({
      rootRef: { current: root },
      ownerId: 'user_1',
      place,
      onCreateFailed,
    }),
  );
}

function click(href: string, init: MouseEventInit = {}, attrs: Record<string, string> = {}) {
  const a = document.createElement('a');
  a.setAttribute('href', href);
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  root.appendChild(a);
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
  a.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  window.history.replaceState(null, '', '/embed/workbench/explorer');
  root = document.createElement('div');
  document.body.appendChild(root);
  onCreateFailed = vi.fn<() => void>();
  create.createProjectInPlace.mockReset();
});

afterEach(() => {
  cleanup();
  root.remove();
  vi.restoreAllMocks();
});

describe('useWorkspaceNavigation', () => {
  it('moves the frame where the Explorer asks, inside its own addresses', () => {
    mount();

    act(() => assignAppLocation('/explorer/folder?id=f1'));
    expect(path()).toBe('/embed/workbench/explorer/folder/f1');

    act(() => assignAppLocation('/project/doc-1?s=CODE2345'));
    expect(path()).toBe('/embed/workbench/project/doc-1?s=CODE2345');
    expect((window.history.state as { workbenchFrom?: string }).workbenchFrom).toBe(
      '/embed/workbench/explorer/folder/f1',
    );
  });

  it('takes a same-origin link click in the capture phase, so no page loads', () => {
    mount();

    const event = click('/explorer/recent');

    expect(event.defaultPrevented).toBe(true);
    expect(path()).toBe('/embed/workbench/explorer/recent');
  });

  it('leaves a click meant for a new tab, or a link to elsewhere, to the browser', () => {
    mount();

    expect(click('/explorer/recent', { metaKey: true }).defaultPrevented).toBe(false);
    expect(click('/explorer/recent', {}, { target: '_blank' }).defaultPrevented).toBe(false);
    expect(click('https://elsewhere.example/x').defaultPrevented).toBe(false);
    expect(path()).toBe('/embed/workbench/explorer');
  });

  it('opens a page the frame does not hold in a new tab', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    mount();

    act(() => assignAppLocation('/help/workbenches'));

    expect(open).toHaveBeenCalledWith(
      `${window.location.origin}/help/workbenches`,
      '_blank',
      'noopener',
    );
    expect(path()).toBe('/embed/workbench/explorer');
  });

  it('makes a new project in place for the wizard, in the folder shown, and opens it', async () => {
    create.createProjectInPlace.mockResolvedValue('doc-new');
    mount({ kind: 'explorer', node: { kind: 'folder', id: 'f1' } });

    await act(async () => assignAppLocation('/new'));

    expect(create.createProjectInPlace).toHaveBeenCalledWith('user_1', {
      folderId: 'f1',
      teamId: null,
      templateKind: null,
    });
    expect(path()).toBe('/embed/workbench/project/doc-new');
  });

  it('says so when the new project cannot be made, and stays', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    create.createProjectInPlace.mockRejectedValue(Object.assign(new Error('no'), { status: 403 }));
    mount();

    await act(async () => assignAppLocation('/new?folder=f1'));

    expect(onCreateFailed).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith('[workbench] create-failed', { status: 403 });
    expect(path()).toBe('/embed/workbench/explorer');
  });

  it('goes back to where a project was opened from, else to Home', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { result } = mount();

    act(() => assignAppLocation('/explorer/recent'));
    act(() => assignAppLocation('/project/doc-1'));
    act(() => result.current.back());
    expect(back).toHaveBeenCalledTimes(1);

    window.history.replaceState(null, '', '/embed/workbench/project/doc-2');
    act(() => result.current.back());
    expect(path()).toBe('/embed/workbench/explorer');
  });

  it('moves to a place, as `liveplanner:open` asks', () => {
    const { result } = mount();

    act(() => result.current.go({ kind: 'explorer', node: { kind: 'folder', id: 'f9' } }));

    expect(path()).toBe('/embed/workbench/explorer/folder/f9');
  });

  it('hands navigation back to the browser once the frame is gone', () => {
    const { unmount } = mount();
    unmount();

    expect(click('/explorer/recent').defaultPrevented).toBe(false);
  });
});
