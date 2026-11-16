// @vitest-environment jsdom

// A live embed's face (live-embeds.md "What a reader sees"): each state's words and controls, the snapshot under all
// of them (unreadable to a reader without access), the frame inert until Use the file, Open at the item's own address
// from controls above the element at one size on screen, and nothing live inside another frame.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CanvasZoomProvider } from '../canvas/CanvasZoomContext';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveEmbedFrame } from './useLiveEmbedFrame';

let frame: LiveEmbedFrame;
const retry = vi.fn();
let slotWanted: boolean[];

vi.mock('./useLiveEmbedSlot', () => ({
  useLiveEmbedSlot: (_ref: unknown, wanted: boolean) => {
    slotWanted.push(wanted);
    return wanted;
  },
}));
vi.mock('./useLiveEmbedFrame', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useLiveEmbedFrame')>()),
  useLiveEmbedFrame: () => ({ ...frame, retry }),
}));

const { LiveEmbedView } = await import('./LiveEmbedView');

const ITEM = { app: 'liveplanner', itemId: 'p1' } as const;
const POSTER = 'data:image/webp;base64,AA==';
const HREF = 'https://www.liveplanner.app/project/p1';

beforeEach(() => {
  frame = { state: 'idle' };
  slotWanted = [];
  retry.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const view = (over: Partial<Parameters<typeof LiveEmbedView>[0]> = {}) =>
  render(
    <LiveEmbedView
      liveItem={ITEM}
      liveName="Roadmap"
      livePoster={POSTER}
      hostName="livedocuments"
      canChoose
      {...over}
    />,
  );

describe('a live embed', () => {
  it('asks an Editor to choose a file when none is, and tells everyone else none is', () => {
    const { rerender, container } = view({ liveItem: undefined, livePoster: undefined });
    expect(screen.getByText('Double-click to choose a file')).toBeTruthy();
    expect(slotWanted.at(-1)).toBe(false);
    rerender(
      <LiveEmbedView
        liveItem={undefined}
        liveName={undefined}
        livePoster={undefined}
        hostName="livedocuments"
        canChoose={false}
      />,
    );
    expect(screen.getByText('No file chosen yet')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows a Community copy’s snapshot alone: no name of another file, no way to open it', () => {
    const { container } = view({ liveItem: undefined });
    expect(container.querySelector('img')?.getAttribute('src')).toBe(POSTER);
    expect(screen.queryByText('Double-click to choose a file')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });

  it('shows the snapshot with the file’s name and Open while idle', () => {
    const { container } = view();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(POSTER);
    expect(screen.getByText('Roadmap')).toBeTruthy();
    const open = screen.getByLabelText('Open in liveplanner');
    expect(open.getAttribute('href')).toBe(HREF);
    expect(open.getAttribute('target')).toBe('_blank');
    expect(container.querySelector('iframe')).toBeNull();
    expect(slotWanted.at(-1)).toBe(true);
  });

  it('frames the file read-only, inert until Use the file, then hands it the pointer', () => {
    frame = {
      state: 'live',
      src: `${'https://www.liveplanner.app'}/embed/workbench?d=p1#ticket=t`,
      ready: true,
    };
    const { container } = view();
    const iframe = container.querySelector('iframe')!;
    expect(iframe.getAttribute('src')).toContain('/embed/workbench?d=p1#ticket=t');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-top-navigation');
    expect(iframe.className).toContain('pointer-events-none');
    expect(screen.getByText('Live')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Use the file'));
    expect(container.querySelector('iframe')!.className).not.toContain('pointer-events-none');
    fireEvent.click(screen.getByLabelText('Done using the file'));
    expect(container.querySelector('iframe')!.className).toContain('pointer-events-none');
  });

  it('keeps the frame hidden and says it is opening until the file says hello', () => {
    frame = {
      state: 'live',
      src: 'https://www.liveplanner.app/embed/workbench?d=p1#ticket=t',
      ready: false,
    };
    const { container } = view();
    expect(container.querySelector('iframe')!.className).toContain('opacity-0');
    expect(screen.getByLabelText('Opening Roadmap')).toBeTruthy();
    expect(screen.queryByLabelText('Use the file')).toBeNull();
  });

  it('shows a reader without access an unreadable snapshot and Open in its app, never the file', () => {
    frame = { state: 'no-access' };
    const { container } = view();
    expect(screen.getByText("You don't have access to Roadmap.")).toBeTruthy();
    expect(screen.getByText('Ask its owner to share it with you.')).toBeTruthy();
    expect(screen.getByText('Open in liveplanner').getAttribute('href')).toBe(HREF);
    expect(screen.queryByText('Request Access')).toBeNull();
    const snapshot = container.querySelector('img')!;
    expect(snapshot.dataset.snapshot).toBe('obscured');
    expect(snapshot.className).toContain('blur-xl');
    expect(snapshot.className).not.toContain('blur-[1.5px]');
    expect(container.querySelector('iframe')).toBeNull();
    // The place goes back: nothing more is asked.
    expect(slotWanted.at(-1)).toBe(false);
  });

  it('only dims, never obscures, a snapshot for a reader who can open the file', () => {
    expect(view().container.querySelector('img')!.dataset.snapshot).toBe('clear');
    cleanup();
    frame = { state: 'failed' };
    expect(view().container.querySelector('img')!.dataset.snapshot).toBe('dim');
  });

  it('puts its controls above the element, counter-scaled to one size on screen', () => {
    const { container } = render(
      <CanvasZoomProvider zoom={0.5}>
        <LiveEmbedView
          liveItem={ITEM}
          liveName="Roadmap"
          livePoster={POSTER}
          hostName="h"
          canChoose
        />
      </CanvasZoomProvider>,
    );
    const controls = container.querySelector<HTMLElement>('[data-live-embed-controls]')!;
    expect(controls.className).toContain('bottom-full');
    expect(controls.style.transform).toBe('scale(2)');
    expect(controls.contains(screen.getByLabelText('Open in liveplanner'))).toBe(true);
  });

  it('says a file is gone, offering an Editor another', () => {
    frame = { state: 'gone' };
    view();
    expect(screen.getByText('This file is no longer there.')).toBeTruthy();
    expect(screen.getByText('Double-click to choose another.')).toBeTruthy();
  });

  it('tells anyone else a gone file was deleted', () => {
    frame = { state: 'gone' };
    view({ canChoose: false });
    expect(screen.getByText('It was deleted or moved to the Trash.')).toBeTruthy();
  });

  it('offers Try Again after a failure, naming the file by its app when it has no name', () => {
    frame = { state: 'failed' };
    view({ liveName: undefined });
    expect(screen.getByText('this liveplanner file could not be shown just now.')).toBeTruthy();
    fireEvent.click(screen.getByText('Try Again'));
    expect(retry).toHaveBeenCalled();
  });

  it('never goes live inside another frame', () => {
    vi.stubGlobal('parent', {});
    view();
    expect(slotWanted.at(-1)).toBe(false);
  });

  it('keeps a control press from the canvas', () => {
    frame = {
      state: 'live',
      src: 'https://www.liveplanner.app/embed/workbench?d=p1#ticket=t',
      ready: true,
    };
    const onPointerDown = vi.fn();
    render(
      <div onPointerDown={onPointerDown}>
        <LiveEmbedView
          liveItem={ITEM}
          liveName="Roadmap"
          livePoster={POSTER}
          hostName="h"
          canChoose={false}
        />
      </div>,
    );
    fireEvent.pointerDown(screen.getByLabelText('Use the file'));
    fireEvent.pointerDown(screen.getByLabelText('Open in liveplanner'));
    expect(onPointerDown).not.toHaveBeenCalled();
  });

  it('keeps a click and a double-click on either Open from the canvas', () => {
    frame = { state: 'no-access' };
    const onClick = vi.fn();
    const onDoubleClick = vi.fn();
    render(
      <div onClick={onClick} onDoubleClick={onDoubleClick}>
        <LiveEmbedView
          liveItem={ITEM}
          liveName="Roadmap"
          livePoster={POSTER}
          hostName="h"
          canChoose
        />
      </div>,
    );
    for (const control of [
      screen.getByText('Open in liveplanner'),
      screen.getByLabelText('Open in liveplanner'),
    ]) {
      fireEvent.click(control);
      fireEvent.doubleClick(control);
    }
    expect(onClick).not.toHaveBeenCalled();
    expect(onDoubleClick).not.toHaveBeenCalled();
  });
});
