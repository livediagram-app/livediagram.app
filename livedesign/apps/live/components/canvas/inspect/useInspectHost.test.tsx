// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/design';
import type { CanvasTool } from '@/components/palette/palette.types';

const m = vi.hoisted(() => ({
  listShareLinks: vi.fn(),
  exportInspectedElement: vi.fn(async () => {}),
  track: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  offline: false,
}));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({
  indexClient: { listShareLinks: m.listShareLinks },
}));
vi.mock('@/lib/inspect-export', async (orig) => ({
  ...(await orig<typeof import('@/lib/inspect-export')>()),
  exportInspectedElement: m.exportInspectedElement,
}));
vi.mock('@/lib/telemetry', () => ({ track: m.track }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => m.toast }));
vi.mock('@/hooks/persistence/useIsOfflineDesign', () => ({ useIsOfflineDesign: () => m.offline }));
vi.mock('@/lib/explorer-host', () => ({
  shareAddress: (code: string) => `https://www.livedesign.app/design/shared?s=${code}`,
}));

import { useInspectHost } from './useInspectHost';

// docs/specs/007-editor/wireframe-pages.md "A link that opens with Inspect".
const tab = { id: 't1', name: 'Tab', elements: [] } as unknown as Tab;
let writeText: ReturnType<typeof vi.fn>;

function host(over: Partial<Parameters<typeof useInspectHost>[0]> = {}) {
  const setCanvasTool = vi.fn<(t: CanvasTool) => void>();
  const openShare = vi.fn();
  const input = {
    canvasTool: 'select' as CanvasTool,
    setCanvasTool,
    wireframeTab: true,
    ready: true,
    activeTab: tab,
    designId: 'd1',
    designName: 'Checkout',
    sessionShareCode: null,
    canShareDesign: true,
    openShare,
    ...over,
  };
  const view = renderHook((p: typeof input) => useInspectHost(p), { initialProps: input });
  return { view, input, setCanvasTool, openShare };
}

beforeEach(() => {
  writeText = vi.fn(async () => {});
  Object.assign(navigator, { clipboard: { writeText } });
  m.offline = false;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('opening with Inspect', () => {
  it('turns Inspect on once when the address asks and the tab is a wireframe tab', () => {
    window.history.replaceState(null, '', '/design/shared?s=abc&inspect=1');
    const { view, input, setCanvasTool } = host();
    expect(setCanvasTool).toHaveBeenCalledWith('inspect');
    setCanvasTool.mockClear();
    view.rerender({ ...input, designName: 'Renamed' });
    expect(setCanvasTool).not.toHaveBeenCalled();
  });

  it('waits for the design to load', () => {
    window.history.replaceState(null, '', '/?inspect');
    const { view, input, setCanvasTool } = host({ ready: false });
    expect(setCanvasTool).not.toHaveBeenCalled();
    view.rerender({ ...input, ready: true });
    expect(setCanvasTool).toHaveBeenCalledWith('inspect');
  });

  it('ignores the parameter on another kind of tab', () => {
    window.history.replaceState(null, '', '/?inspect');
    const { setCanvasTool } = host({ wireframeTab: false });
    expect(setCanvasTool).not.toHaveBeenCalled();
  });

  it('leaves Inspect when the tab is not a wireframe tab', () => {
    const { setCanvasTool } = host({ canvasTool: 'inspect', wireframeTab: false });
    expect(setCanvasTool).toHaveBeenCalledWith('select');
  });
});

describe('Copy Inspect Link', () => {
  it('copies a visitor’s own link with inspect', async () => {
    const { view } = host({ sessionShareCode: 'visit', canShareDesign: false });
    await act(() => view.result.current.copyLink!());
    expect(writeText).toHaveBeenCalledWith(
      'https://www.livedesign.app/design/shared?s=visit&inspect=1',
    );
    expect(m.listShareLinks).not.toHaveBeenCalled();
    expect(m.track).toHaveBeenCalledWith('UI', 'Copied', 'InspectLink');
  });

  it('copies the design’s live Viewer link for its owner', async () => {
    m.listShareLinks.mockResolvedValue({
      links: [
        { code: 'ed', level: 'edit', tabId: null, expiresAt: null },
        { code: 'vw', level: 'view', tabId: null, expiresAt: null },
      ],
    });
    const { view } = host();
    await act(() => view.result.current.copyLink!());
    expect(writeText).toHaveBeenCalledWith(
      'https://www.livedesign.app/design/shared?s=vw&inspect=1',
    );
  });

  it('opens Share with a note when there is no Viewer link, making none', async () => {
    m.listShareLinks.mockResolvedValue({ links: [] });
    const { view, openShare } = host();
    await act(() => view.result.current.copyLink!());
    expect(openShare).toHaveBeenCalledOnce();
    expect(m.toast.info).toHaveBeenCalledWith('Make a Viewer link, then copy the Inspect link.');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('says when the links cannot be read, or the copy fails', async () => {
    m.listShareLinks.mockRejectedValueOnce(new Error('offline'));
    const { view } = host();
    await act(() => view.result.current.copyLink!());
    expect(m.toast.error).toHaveBeenCalledTimes(1);
    writeText.mockRejectedValueOnce(new Error('denied'));
    m.listShareLinks.mockResolvedValue({
      links: [{ code: 'vw', level: 'view', tabId: null, expiresAt: null }],
    });
    await act(() => view.result.current.copyLink!());
    expect(m.toast.error).toHaveBeenCalledTimes(2);
  });

  it('offers no link for a design kept in This Browser, or one a visitor may not share', () => {
    m.offline = true;
    expect(host().view.result.current.copyLink).toBeNull();
    m.offline = false;
    expect(host({ canShareDesign: false }).view.result.current.copyLink).toBeNull();
  });

  it('does nothing without a design', async () => {
    const { view } = host({ designId: null });
    await act(() => view.result.current.copyLink!());
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('exporting', () => {
  it('exports the element named for the design and records the format', async () => {
    const { view } = host();
    const el = { id: 'e' } as never;
    await act(() =>
      view.result.current.exportElement({
        el,
        elementName: 'Button',
        format: 'png',
        scale: 2,
        surface: 'light',
      }),
    );
    expect(m.exportInspectedElement).toHaveBeenCalledWith(
      expect.objectContaining({ el, fileName: 'Checkout - Button@2x.png', scale: 2 }),
    );
    expect(m.track).toHaveBeenCalledWith('Document', 'Exported', 'InspectPng');
    await act(() =>
      view.result.current.exportElement({
        el,
        elementName: 'Button',
        format: 'svg',
        scale: 1,
        surface: 'light',
      }),
    );
    expect(m.track).toHaveBeenCalledWith('Document', 'Exported', 'InspectSvg');
  });
});
