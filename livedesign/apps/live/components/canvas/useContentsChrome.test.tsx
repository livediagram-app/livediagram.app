// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages } from '@livedesign/document';
import { track } from '@/lib/telemetry';
import { readUserPreferences, writeUserPreferences } from '@/lib/user-preferences';
import type { CanvasChromeProps } from './CanvasChrome';
import { useContentsChrome } from './useContentsChrome';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/pages-mode.md "Contents": docked as a sidebar on a desktop until the
// person minimises it; the popover over its button otherwise; a phone never has the sidebar.
afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

const slide = (id: string) =>
  ({ id, orientation: 'landscape', kind: 'logo', size: 'logo' }) as const;
const pagesMode = {
  pages: layOutPages([slide('p1'), slide('p2')]),
  focusPage: () => {},
};

function chrome(
  props: Partial<CanvasChromeProps> = {},
  { isMobile = false, chromeHidden = false } = {},
) {
  const closeDockPanel = vi.fn();
  const { result } = renderHook(() =>
    useContentsChrome({
      props: {
        pagesMode,
        userPreferences: {},
        elements: [],
        layers: [],
        activeTabId: 't',
        activeDockPanel: null,
        activeDockAnchor: null,
        selfParticipant: { id: 'owner-1' },
        ...props,
      } as unknown as CanvasChromeProps,
      chromeHidden,
      isMobile,
      closeDockPanel,
    }),
  );
  return { ...result.current, closeDockPanel };
}

describe('useContentsChrome', () => {
  it('docks the sidebar by default on a desktop, with no popover', () => {
    const c = chrome({ activeDockPanel: 'contents' });
    expect(c.contentsDocked).toBe(true);
    expect(c.contentsSidebarEl).not.toBeNull();
    expect(c.contentsPopoverEl).toBeNull();
    // A popover left open from before the sidebar docked closes.
    expect(c.closeDockPanel).toHaveBeenCalled();
  });

  it('keeps the button with a single page: nothing to find your way round', () => {
    const one = { ...pagesMode, pages: layOutPages([slide('p1')]) };
    const c = chrome({ pagesMode: one } as never);
    expect(c.contentsDocked).toBe(false);
    expect(c.contentsSidebarEl).toBeNull();
  });

  it('pins to the left until moved, the side kept in this browser alone', () => {
    expect(chrome().contentsSide).toBe('left');
    const docked = chrome();
    (
      docked.contentsSidebarEl as ReactElement<{ onMoveToSide: (side: 'right') => void }>
    ).props.onMoveToSide('right');
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'ContentsSideRight');
    expect(localStorage.getItem('livedesign:contents-side:v1')).toBe('right');
    expect(chrome().contentsSide).toBe('right');
    // Never in the synced preferences.
    expect(readUserPreferences()).not.toHaveProperty('contentsSide');
  });

  it('never docks on a phone, whatever the choice', () => {
    const c = chrome({ activeDockPanel: 'contents' }, { isMobile: true });
    expect(c.contentsDocked).toBe(false);
    expect(c.contentsSidebarEl).toBeNull();
    expect(c.contentsPopoverEl).not.toBeNull();
  });

  it('is the button once minimised: its popover opens over it', () => {
    const shut = chrome({ userPreferences: { contentsPlacement: 'button' } });
    expect(shut.contentsDocked).toBe(false);
    expect(shut.contentsPopoverEl).toBeNull();
    const open = chrome({
      userPreferences: { contentsPlacement: 'button' },
      activeDockPanel: 'contents',
    });
    expect(open.contentsPopoverEl).not.toBeNull();
  });

  it('shows nothing in Zen, with the chrome away, or outside Pages', () => {
    expect(chrome({ zenMode: true }).contentsSidebarEl).toBeNull();
    expect(chrome({}, { chromeHidden: true }).contentsSidebarEl).toBeNull();
    const none = chrome({ pagesMode: null, activeDockPanel: 'contents' });
    expect(none.contentsSidebarEl).toBeNull();
    expect(none.contentsPopoverEl).toBeNull();
  });

  it('keeps the choice in the synced preferences, telling telemetry first', () => {
    writeUserPreferences({ alignmentGuides: true });
    const docked = chrome();
    const write = vi.fn();
    vi.mocked(track).mockImplementation(() => {
      write(readUserPreferences().contentsPlacement);
    });
    (docked.contentsSidebarEl as ReactElement<{ onMinimise: () => void }>).props.onMinimise();
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'ContentsPlacementButton');
    // Sent before the change was kept.
    expect(write).toHaveBeenCalledWith(undefined);
    expect(readUserPreferences()).toEqual({ alignmentGuides: true, contentsPlacement: 'button' });

    const button = chrome({
      userPreferences: { contentsPlacement: 'button' },
      activeDockPanel: 'contents',
    });
    (button.contentsPopoverEl as ReactElement<{ onDock: () => void }>).props.onDock();
    expect(button.closeDockPanel).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'ContentsPlacementSidebar');
    expect(readUserPreferences().contentsPlacement).toBe('sidebar');
  });
});
