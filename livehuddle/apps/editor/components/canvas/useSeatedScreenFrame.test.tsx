// @vitest-environment jsdom

// Sitting facing a Screen frames it (docs/specs/008-canvas/avatar-mode.md "The camera", Work Tracker 1427): the
// glide out on sitting down, the zoom put back on standing up, and the cases that leave the view alone.
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { createStateStore } from '@liveworkspace/workbench/lib/state-store';
import type { AvatarPose } from '@livehuddle/avatar/pose';
import { SELF_MEDIA_ID } from '@/lib/calls/calls-media-store';
import { setMeetingLive } from '@/lib/office/meeting-live';
import { screensInYourRoom, useSeatedScreenFrame } from './useSeatedScreenFrame';

vi.mock('@liveworkspace/workbench/lib/viewport-glide', () => ({
  glideViewport: (
    _from: unknown,
    to: { zoom: number; offset: { x: number; y: number } },
    set: { zoom: (z: number) => void; offset: (o: { x: number; y: number }) => void },
  ) => {
    set.zoom(to.zoom);
    set.offset(to.offset);
    return () => {};
  },
}));

const screenEl = {
  ...createShape('screen', -400, -660),
  id: 'wall',
  width: 800,
  height: 500,
} as Element;
const pose = (pos: { x: number; y: number } | null, facing: AvatarPose['facing'] = 'up') =>
  ({ pos, facing, walking: false, stepFrame: 0, lift: 0, wave: null, pose: null }) as AvatarPose;

let zoom: number;
let offset: { x: number; y: number };
const main = { current: { offsetWidth: 1440, offsetHeight: 844 } as HTMLElement };

function setup(initial: {
  seatedOn: string | null;
  active?: boolean;
  pos?: { x: number; y: number };
}) {
  const poseStore = createStateStore<AvatarPose>(pose(initial.pos ?? { x: -300, y: 200 }));
  const setViewportZoom = vi.fn((z: number | ((p: number) => number)) => {
    zoom = typeof z === 'function' ? z(zoom) : z;
  });
  const setViewportOffset = vi.fn((o: { x: number; y: number }) => {
    offset = o;
  });
  const props = (seatedOn: string | null, active = initial.active ?? true) => ({
    active,
    seatedOn,
    poseStore,
    elements: [screenEl],
    mainRef: main,
    viewportZoom: zoom,
    readViewportOffset: () => offset,
    setViewportOffset,
    setViewportZoom,
  });
  const view = renderHook((p: ReturnType<typeof props>) => useSeatedScreenFrame(p), {
    initialProps: props(initial.seatedOn),
  });
  return { view, props, poseStore, setViewportZoom, setViewportOffset };
}

beforeEach(() => {
  zoom = 1.4;
  offset = { x: 0, y: 0 };
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 1;
  });
  setMeetingLive(new Map([['wall', { roomId: 'r', inside: [{ id: SELF_MEDIA_ID, name: null }] }]]));
});

afterEach(() => {
  vi.restoreAllMocks();
  setMeetingLive(new Map());
});

describe('useSeatedScreenFrame', () => {
  it('glides out to the Screen on sitting, and puts the zoom back centred on you on standing', () => {
    const { view, props, setViewportZoom } = setup({ seatedOn: null });
    expect(setViewportZoom).not.toHaveBeenCalled();
    view.rerender(props('chair1'));
    expect(zoom).toBeLessThan(1.4);
    const framed = zoom;
    view.rerender(props(null));
    expect(zoom).toBe(1.4);
    expect(offset).toEqual({ x: 720 + 300, y: 422 - 200 });
    expect(framed).toBeGreaterThan(0.5);
  });

  it('keeps a zoom you chose while seated', () => {
    const { view, props, setViewportZoom } = setup({ seatedOn: null });
    view.rerender(props('chair1'));
    zoom = 2;
    setViewportZoom.mockClear();
    view.rerender(props(null));
    expect(setViewportZoom).not.toHaveBeenCalled();
  });

  it('leaves the view alone with no Screen ahead, or out of your room, or out of the mode', () => {
    const behind = setup({ seatedOn: null, pos: { x: 0, y: -900 } });
    behind.view.rerender(behind.props('chair1'));
    expect(behind.setViewportZoom).not.toHaveBeenCalled();
    behind.view.unmount();

    setMeetingLive(new Map([['wall', { roomId: 'r', inside: [] }]]));
    const away = setup({ seatedOn: null });
    away.view.rerender(away.props('chair1'));
    expect(away.setViewportZoom).not.toHaveBeenCalled();
    away.view.unmount();

    setMeetingLive(
      new Map([['wall', { roomId: 'r', inside: [{ id: SELF_MEDIA_ID, name: null }] }]]),
    );
    const editing = setup({ seatedOn: null, active: false });
    editing.view.rerender(editing.props('chair1', false));
    expect(editing.setViewportZoom).not.toHaveBeenCalled();
  });

  it('forgets the frame on leaving the mode, so standing later puts nothing back', () => {
    const { view, props, setViewportZoom } = setup({ seatedOn: null });
    view.rerender(props('chair1'));
    view.rerender(props('chair1', false));
    setViewportZoom.mockClear();
    view.rerender(props(null, true));
    expect(setViewportZoom).not.toHaveBeenCalled();
  });

  it('counts only the Screens whose room you stand in', () => {
    expect(screensInYourRoom([screenEl])).toHaveLength(1);
    setMeetingLive(new Map());
    expect(screensInYourRoom([screenEl])).toEqual([]);
  });
});
