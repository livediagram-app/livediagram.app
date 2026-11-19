// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/design';
import { StrictMode } from 'react';

const m = vi.hoisted(() => ({
  listShareLinks: vi.fn(),
  track: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  offline: false,
  pageId: null as string | null,
}));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({
  indexClient: { listShareLinks: m.listShareLinks },
}));
vi.mock('@/lib/telemetry', () => ({ track: m.track }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => m.toast }));
vi.mock('@/hooks/persistence/useIsOfflineDesign', () => ({ useIsOfflineDesign: () => m.offline }));
vi.mock('@/lib/explorer-host', () => ({
  shareAddress: (code: string) => `https://www.livedesign.app/design/shared?s=${code}`,
}));
vi.mock('@/lib/current-page-kind', () => ({ currentPageIdNow: () => m.pageId }));

import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { closePrototype, openPrototype, usePrototypePlayer } from '@/lib/prototype-player-store';
import { offersPrototype, PrototypeHeaderButton } from '@/components/chrome/PrototypeHeaderButton';
import { usePrototypeHost } from './usePrototypeHost';

// docs/specs/007-editor/wireframe-pages.md "Prototype mode", "Sharing a prototype", "Share roles".
let writeText: ReturnType<typeof vi.fn>;

function host(over: Partial<Parameters<typeof usePrototypeHost>[0]> = {}) {
  const openShare = vi.fn();
  const focusPage = vi.fn();
  const input = {
    wireframeTab: true,
    ready: true,
    tabId: 't1',
    designId: 'd1',
    sessionShareCode: null,
    canShareDesign: true,
    openShare,
    focusPage,
    ...over,
  };
  const view = renderHook((p: typeof input) => usePrototypeHost(p), { initialProps: input });
  return { view, input, openShare, focusPage };
}

beforeEach(() => {
  writeText = vi.fn(async () => {});
  Object.assign(navigator, { clipboard: { writeText } });
  m.offline = false;
  m.pageId = null;
});

afterEach(() => {
  cleanup();
  closePrototype();
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('a prototype link', () => {
  it('opens Prototype mode once on a wireframe tab, on its first screen', () => {
    window.history.replaceState(null, '', '/design/shared?s=abc&prototype=1');
    const { view, input } = host();
    expect(view.result.current.open).toBe(true);
    expect(view.result.current.startId).toBeNull();
    expect(m.track).toHaveBeenCalledWith('Canvas', 'Used', 'Prototype');
    act(() => view.result.current.close('p2'));
    view.rerender({ ...input, tabId: 't1' });
    expect(view.result.current.open).toBe(false);
  });

  it('opens under StrictMode with the design already loaded (a share link)', () => {
    window.history.replaceState(null, '', '/design/shared?s=abc&prototype=1');
    const input = {
      wireframeTab: true,
      ready: true,
      tabId: 't1',
      designId: 'd1',
      sessionShareCode: 'abc',
      canShareDesign: false,
      openShare: vi.fn(),
      focusPage: vi.fn(),
    };
    const view = renderHook(() => usePrototypeHost(input), { wrapper: StrictMode });
    expect(view.result.current.open).toBe(true);
  });

  it('waits for the design to load', () => {
    window.history.replaceState(null, '', '/?prototype');
    const { view, input } = host({ ready: false });
    expect(view.result.current.open).toBe(false);
    view.rerender({ ...input, ready: true });
    expect(view.result.current.open).toBe(true);
  });

  it('is ignored on another kind of tab, or when it says no', () => {
    window.history.replaceState(null, '', '/?prototype');
    expect(host({ wireframeTab: false }).view.result.current.open).toBe(false);
    cleanup();
    window.history.replaceState(null, '', '/?prototype=0');
    expect(host().view.result.current.open).toBe(false);
  });
});

describe('the player’s host', () => {
  it('frames the screen last shown on Close', () => {
    const { view, focusPage } = host();
    act(() => openPrototype('p1'));
    expect(view.result.current).toMatchObject({ open: true, startId: 'p1' });
    act(() => view.result.current.close('p3'));
    expect(view.result.current.open).toBe(false);
    expect(focusPage).toHaveBeenCalledWith('p3');
  });

  it('closes when the tab stops being a wireframe tab, and when the editor goes', () => {
    const { view, input } = host();
    act(() => openPrototype(null));
    view.rerender({ ...input, wireframeTab: false });
    expect(view.result.current.open).toBe(false);
    act(() => openPrototype(null));
    view.unmount();
    const { result } = renderHook(() => usePrototypePlayer());
    expect(result.current.open).toBe(false);
  });

  it('tracks one opening while it is open', () => {
    host();
    act(() => openPrototype(null));
    act(() => openPrototype('p2'));
    expect(m.track).toHaveBeenCalledTimes(1);
  });
});

describe('Copy Prototype Link', () => {
  it('copies a visitor’s own link with prototype', async () => {
    const { view } = host({ sessionShareCode: 'visit', canShareDesign: false });
    await act(async () => view.result.current.copyLink!());
    expect(writeText).toHaveBeenCalledWith(
      'https://www.livedesign.app/design/shared?s=visit&prototype=1',
    );
    expect(m.toast.success).toHaveBeenCalledWith('Copied a link that opens the prototype');
    expect(m.track).toHaveBeenCalledWith('UI', 'Copied', 'PrototypeLink');
  });

  it('copies the design’s Viewer link for its owner, and opens Share when there is none', async () => {
    m.listShareLinks.mockResolvedValueOnce({
      links: [{ code: 'vw', level: 'view', tabId: null, expiresAt: null }],
    });
    const { view, openShare } = host();
    await act(async () => view.result.current.copyLink!());
    expect(writeText).toHaveBeenCalledWith(
      'https://www.livedesign.app/design/shared?s=vw&prototype=1',
    );
    m.listShareLinks.mockResolvedValueOnce({ links: [] });
    await act(async () => view.result.current.copyLink!());
    expect(openShare).toHaveBeenCalled();
    expect(m.toast.info).toHaveBeenCalledWith('Make a Viewer link, then copy the Prototype link.');
    expect(m.track).toHaveBeenCalledTimes(1);
  });

  it('is not offered on a design kept Offline, or to a visitor who may not share', () => {
    m.offline = true;
    expect(host().view.result.current.copyLink).toBeNull();
    cleanup();
    m.offline = false;
    expect(host({ canShareDesign: false }).view.result.current.copyLink).toBeNull();
  });
});

describe('the header’s Prototype', () => {
  const wireTab = { pages: [{ id: 'p1', kind: 'wireframe', orientation: 'portrait' }] } as Tab;
  const logoTab = { pages: [{ id: 'p1', kind: 'logo', orientation: 'portrait' }] } as Tab;

  it('is every role’s on a wireframe tab: Editor, Participant and Viewer', () => {
    for (const level of ['edit', 'participate', 'view'] as const) {
      const can = resolveEditorCapabilities({ level, adderKey: 'a'.repeat(32) });
      expect(offersPrototype(can, wireTab, false), level).toBe(true);
    }
  });

  it('is not offered on another kind of tab or while a welcome is open', () => {
    const can = resolveEditorCapabilities({ level: 'edit', adderKey: null });
    expect(offersPrototype(can, logoTab, false)).toBe(false);
    expect(offersPrototype(can, wireTab, true)).toBe(false);
    expect(offersPrototype({ playPrototype: false }, wireTab, false)).toBe(false);
  });

  it('plays from the screen in view', () => {
    m.pageId = 'p2';
    render(<PrototypeHeaderButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Prototype' }));
    const { result } = renderHook(() => usePrototypePlayer());
    expect(result.current).toEqual({ open: true, startId: 'p2' });
  });
});
