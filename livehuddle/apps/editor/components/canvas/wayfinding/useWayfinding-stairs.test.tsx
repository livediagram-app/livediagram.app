// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeElement, type Tab } from '@livehuddle/document';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { stairsFlights, stairsFootPoint, stairsTopPoint } from '@/lib/wayfinding';
import { CLIMB_MAX_MS, CLIMB_NEAR, useWayfinding, type WayfindingInput } from './useWayfinding';

// docs/specs/009-elements/stairs.md "Taking them": the walk up, the travel as a tab change that keeps Avatar mode, the
// walk off the landing Stairs, the fallback when the climb never arrives, and reduced motion.

vi.mock('@liveworkspace/workbench/lib/motion-preference', () => ({
  prefersReducedMotion: vi.fn(() => false),
}));

const at = (kind: Parameters<typeof createShape>[0], x: number, y: number) =>
  ({ ...createShape(kind, x, y), id: `${kind}-${x}-${y}` }) as ShapeElement;

const down = at('stairs', 100, 100);
const up = at('stairs', 110, 100);
const TABS = [
  { id: 'g', name: 'Ground', elements: [down] },
  { id: 'l2', name: 'Level 2', elements: [up] },
] as unknown as Tab[];

function setup(over: Partial<WayfindingInput> = {}) {
  const walkTo = vi.fn();
  const teleportTo = vi.fn();
  const onTravelToTab = vi.fn();
  const base: WayfindingInput = {
    walking: true,
    activeTabId: 'g',
    tabs: TABS,
    elements: [down] as Element[],
    self: { id: 'me', name: 'Me', color: '#f00' },
    remoteAvatars: [],
    avatar: { pos: stairsFootPoint(down), standingOnId: null, walkTo, teleportTo },
    enterWalking: vi.fn(),
    onFollowLink: vi.fn(),
    onTravelToTab,
    mainRef: null,
    readZoom: () => 1,
    setViewportOffset: vi.fn(),
    ...over,
  };
  const hook = renderHook((input: WayfindingInput) => useWayfinding(input), {
    initialProps: base,
  });
  const climb = () => {
    const flight = stairsFlights(TABS, 'g', down).up!;
    act(() => hook.result.current.actions.climb({ from: down, flight }));
  };
  // The tab the travel asked for shows.
  const showUpstairs = () =>
    hook.rerender({ ...base, activeTabId: 'l2', elements: [up] as Element[] });
  return { hook, base, walkTo, teleportTo, onTravelToTab, climb, showUpstairs };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(prefersReducedMotion).mockReturnValue(false);
});
afterEach(() => vi.useRealTimers());

describe('taking the Stairs', () => {
  it('walks up the flight, travels on arriving, and walks off the landing Stairs', () => {
    const { walkTo, teleportTo, onTravelToTab, climb, showUpstairs } = setup();
    climb();
    expect(walkTo).toHaveBeenCalledWith(stairsTopPoint(down), expect.any(Function));
    expect(onTravelToTab).not.toHaveBeenCalled();
    act(() => {
      (walkTo.mock.calls[0]![1] as () => void)();
    });
    expect(teleportTo).toHaveBeenCalledWith(stairsTopPoint(up), up.id);
    expect(onTravelToTab).toHaveBeenCalledWith('l2');
    showUpstairs();
    expect(walkTo).toHaveBeenLastCalledWith(stairsFootPoint(up));
    // The fallback never travels a second time.
    act(() => {
      vi.advanceTimersByTime(CLIMB_MAX_MS);
    });
    expect(onTravelToTab).toHaveBeenCalledTimes(1);
  });

  it('travels after CLIMB_MAX_MS when the climb never arrives', () => {
    const { onTravelToTab, climb } = setup();
    climb();
    act(() => {
      vi.advanceTimersByTime(CLIMB_MAX_MS - 1);
    });
    expect(onTravelToTab).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onTravelToTab).toHaveBeenCalledWith('l2');
  });

  it('climbs from on the Stairs too, and travels at once from across the room', () => {
    const on = setup({
      avatar: {
        pos: { x: down.x + 10, y: down.y + 10 },
        standingOnId: down.id,
        walkTo: vi.fn(),
        teleportTo: vi.fn(),
      },
    });
    on.climb();
    expect(on.base.avatar.walkTo).toHaveBeenCalledTimes(1);
    const foot = stairsFootPoint(down);
    const far = setup({
      avatar: {
        pos: { x: foot.x + CLIMB_NEAR + 1, y: foot.y },
        standingOnId: null,
        walkTo: vi.fn(),
        teleportTo: vi.fn(),
      },
    });
    far.climb();
    expect(far.base.avatar.walkTo).not.toHaveBeenCalled();
    expect(far.base.avatar.teleportTo).toHaveBeenCalledWith(stairsTopPoint(up), up.id);
    expect(far.onTravelToTab).toHaveBeenCalledWith('l2');
  });

  it('under reduced motion, stands at the landing foot with no walk', () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true);
    const { walkTo, teleportTo, onTravelToTab, climb, showUpstairs } = setup();
    climb();
    expect(teleportTo).toHaveBeenCalledWith(stairsFootPoint(up), up.id);
    expect(onTravelToTab).toHaveBeenCalledWith('l2');
    showUpstairs();
    expect(walkTo).not.toHaveBeenCalled();
  });

  it('not walking, moves the view only', () => {
    const { walkTo, teleportTo, onTravelToTab, climb, showUpstairs } = setup({ walking: false });
    climb();
    expect(teleportTo).not.toHaveBeenCalled();
    expect(onTravelToTab).toHaveBeenCalledWith('l2');
    showUpstairs();
    expect(walkTo).not.toHaveBeenCalled();
  });

  it('never travels after the canvas goes mid-climb', () => {
    const { hook, onTravelToTab, climb } = setup();
    climb();
    hook.unmount();
    act(() => {
      vi.advanceTimersByTime(CLIMB_MAX_MS);
    });
    expect(onTravelToTab).not.toHaveBeenCalled();
  });

  it('opens the panel when a character walks onto the Stairs', () => {
    const { hook, base } = setup();
    hook.rerender({ ...base, avatar: { ...base.avatar, standingOnId: down.id } });
    expect(hook.result.current.store.get().openPanelId).toBe(down.id);
  });
});
