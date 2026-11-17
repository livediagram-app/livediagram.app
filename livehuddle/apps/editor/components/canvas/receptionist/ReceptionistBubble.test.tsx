// @vitest-environment jsdom

// The Receptionist's bubble (docs/specs/008-canvas/receptionist.md "The welcome", "Asking the Receptionist", "The topics").

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  askReceptionist,
  getReceptionistState,
  openReceptionist,
  resetReceptionistState,
  sayReceptionistFarewell,
  setReceptionistPerson,
  showReceptionistTopic,
} from '@/lib/receptionist/receptionist-store';
import { Space3DOverlayProvider } from '@/components/canvas/space-3d/Space3DOverlay';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { ReceptionistBubble } from './ReceptionistBubble';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

const bubble = () =>
  render(<ReceptionistBubble head={{ x: 100, y: 100 }} feet={{ x: 100, y: 180 }} zoom={1} />);
const replies = () => screen.getAllByRole('button').map((b) => b.textContent);
// His whole line, as a screen reader hears it (the typed text shows a letter at a time).
const said = () => document.querySelector('[aria-live] .sr-only')?.textContent;

beforeEach(() => {
  resetReceptionistState();
  setReceptionistPerson({ speak: true, edit: true }, []);
});
afterEach(() => {
  cleanup();
  resetReceptionistState();
  track.mockReset();
  document.body.innerHTML = '';
});

describe('ReceptionistBubble', () => {
  it('draws nothing while closed', () => {
    const { container } = bubble();
    expect(container.innerHTML).toBe('');
  });

  it('welcomes with every topic in one list, then I’ll Explore and, for an Editor, Leave', () => {
    openReceptionist('welcome');
    render(
      <ReceptionistBubble
        head={{ x: 100, y: 100 }}
        feet={{ x: 100, y: 180 }}
        zoom={1}
        onLeave={() => {}}
      />,
    );
    expect(said()).toBe("Welcome in! I'm the receptionist. What should I show you?");
    const all = replies();
    expect(all).toHaveLength(17);
    expect(all.slice(-2)).toEqual(["I'll Explore", 'Ask Receptionist to Leave']);
    expect(all).not.toContain('More Topics ›');
    for (const group of ['Talk', 'Meet', 'Move', 'You', 'Space'])
      expect(screen.getByText(group)).toBeTruthy();
  });

  it('answers a topic, rings its control, and goes back to the list', () => {
    const map = document.createElement('div');
    map.setAttribute('data-tour-id', 'minimap');
    map.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 50 }) as DOMRect;
    document.body.appendChild(map);
    openReceptionist('welcome');
    bubble();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Getting Around' }));
    fireEvent.click(screen.getByRole('button', { name: 'Getting Around' }));
    expect(track).toHaveBeenCalledWith('UI', 'View', 'ReceptionistTopicGettingAround');
    expect(said()).toMatch(/Arrow keys or a click on the floor/);
    const ring = document.querySelector<HTMLElement>('[data-receptionist-ring]')!;
    expect(ring.style.left).toBe('4px');
    expect(ring.style.width).toBe('112px');
    fireEvent.click(screen.getByRole('button', { name: 'Another Topic' }));
    expect(getReceptionistState().chat).toMatchObject({ topicId: null });
  });

  it('rings nothing for a control that is not on screen, or for a room', () => {
    openReceptionist('welcome');
    bubble();
    act(() => showReceptionistTopic('getting-around'));
    expect(document.querySelector('[data-receptionist-ring]')).toBeNull();
    act(() => showReceptionistTopic('rooms'));
    expect(document.querySelector('[data-receptionist-ring]')).toBeNull();
  });

  it('keeps heard topics in the list with a tick, and closes on I’ll Explore', () => {
    setReceptionistPerson({ speak: true, edit: true }, ['look']);
    askReceptionist();
    bubble();
    expect(said()).toBe('What can I help with?');
    const heard = screen.getByRole('button', { name: /Looking Like Me\s*\(heard\)/ });
    expect(heard.textContent).toMatch(/^✓/);
    expect(screen.getByRole('button', { name: 'Talking to People' })).toBeTruthy();
    // Only an Editor's bubble with somewhere to send him offers Leave.
    expect(screen.queryByRole('button', { name: 'Ask Receptionist to Leave' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: "I'll Explore" }));
    expect(getReceptionistState().chat.open).toBe(false);
  });

  it('says hello back by first name with the topics straight away, and answers a bell you rang', () => {
    setReceptionistPerson({ speak: true, edit: true }, [], 'Sam');
    openReceptionist('back');
    const { unmount } = bubble();
    expect(said()).toBe('Welcome back, Sam! What can I help with?');
    expect(screen.getByRole('button', { name: 'Getting Around' })).toBeTruthy();
    expect(screen.getByRole('button', { name: "I'll Explore" })).toBeTruthy();
    unmount();
    openReceptionist('bell');
    bubble();
    expect(said()).toBe('You rang, Sam? What can I help with?');
    expect(screen.getByRole('button', { name: 'Getting Around' })).toBeTruthy();
  });

  it('says goodbye with no replies once asked to leave', () => {
    const leave = vi.fn();
    askReceptionist();
    render(
      <ReceptionistBubble
        head={{ x: 100, y: 100 }}
        feet={{ x: 100, y: 180 }}
        zoom={1}
        onLeave={leave}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ask Receptionist to Leave' }));
    expect(leave).toHaveBeenCalledOnce();
    act(() => sayReceptionistFarewell());
    expect(said()).toBe("Of course. Bring me back any time from the Avatar Pad's menu.");
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('leaves out what the person may not do', () => {
    setReceptionistPerson({ speak: false, edit: false }, []);
    askReceptionist();
    bubble();
    expect(screen.queryByRole('button', { name: 'Say, Actions and React' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Building the Space' })).toBeNull();
  });

  it('flips under his feet when there is no room above him, and keeps off the sides', () => {
    const root = document.createElement('div');
    root.setAttribute('data-canvas-root', '');
    document.body.appendChild(root);
    root.getBoundingClientRect = () => ({ left: 0, right: 400, top: 0, bottom: 800 }) as DOMRect;
    // The card sits 40px past the left edge, and too high to fit above him; it moves with its nudge.
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this === root) return { left: 0, right: 400, top: 0, bottom: 800 } as DOMRect;
        const shift = Number(/translateX\((-?[\d.]+)px\)/.exec(this.style.transform)?.[1] ?? 0);
        return {
          left: -40 + shift,
          right: 300 + shift,
          top: 10,
          bottom: 210,
          width: 340,
          height: 200,
        } as DOMRect;
      });
    openReceptionist('welcome');
    render(<ReceptionistBubble head={{ x: 100, y: 100 }} feet={{ x: 100, y: 180 }} zoom={1} />, {
      container: root,
    });
    const dialog = screen.getByRole('dialog', { name: 'Receptionist' });
    expect(dialog.style.top).toBe('180px');
    expect((dialog.firstElementChild as HTMLElement).style.transform).toBe('translateX(56px)');
    spy.mockRestore();
  });

  // docs/specs/008-canvas/3d-view.md "What it shows": in 3D the card stands over his head, drawn in the overlay.
  it('goes back over his head when the 3D view turns on, and into the overlay, never under his feet', () => {
    const root = document.createElement('div');
    root.setAttribute('data-canvas-root', '');
    document.body.appendChild(root);
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this === root) return { left: 0, right: 400, top: 0, bottom: 800 } as DOMRect;
        const shift = Number(/translateX\((-?[\d.]+)px\)/.exec(this.style.transform)?.[1] ?? 0);
        return {
          left: -40 + shift,
          right: 300 + shift,
          top: 10,
          bottom: 210,
          width: 340,
          height: 200,
        } as DOMRect;
      });
    openReceptionist('welcome');
    const card = (on: boolean, node: HTMLElement | null = null) => (
      <Space3DOverlayProvider value={{ on, node }}>
        <ReceptionistBubble head={{ x: 100, y: 100 }} feet={{ x: 100, y: 180 }} zoom={1} />
      </Space3DOverlayProvider>
    );
    const { rerender } = render(card(false), { container: root });
    const dialog = () => screen.getByRole('dialog', { name: 'Receptionist' });
    // Flat, with no room above him, it flips under his feet.
    expect(dialog().style.top).toBe('180px');
    // The 3D view turns on: placed again, over his head.
    rerender(card(true));
    expect(dialog().style.top).toBe('100px');
    // With the overlay drawn, the card is in it, outside the world.
    const overlay = root.appendChild(document.createElement('div'));
    rerender(card(true, overlay));
    expect(overlay.contains(dialog())).toBe(true);
    expect(dialog().style.top).toBe('100px');
    spy.mockRestore();
  });

  // Work Tracker 912: on a 390 px phone the welcome ran off the screen's right edge. His head's canvas point and the
  // zoom stay the same through a pan, a camera fit or a resize, so the card is placed again on each, near either edge.
  describe('kept on screen as the view or the window changes', () => {
    // The canvas, a phone's width; the card 300 px wide, standing where the view puts it (`pan`), moved by its nudge.
    let pan = 0;
    let spy: MockInstance<(this: HTMLElement) => DOMRect>;
    let root: HTMLElement;
    const nudge = () =>
      (screen.getByRole('dialog', { name: 'Receptionist' }).firstElementChild as HTMLElement).style
        .transform;
    const frame = () => act(() => new Promise((done) => setTimeout(done, 40)));
    beforeEach(() => {
      pan = 0;
      root = document.body.appendChild(document.createElement('div'));
      root.setAttribute('data-canvas-root', '');
      spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement,
      ) {
        if (this === root) return { left: 0, right: 390, top: 0, bottom: 844 } as DOMRect;
        const shift = Number(/translateX\((-?[\d.]+)px\)/.exec(this.style.transform)?.[1] ?? 0);
        const left = 40 + pan + shift;
        return {
          left,
          right: left + 300,
          top: 300,
          bottom: 500,
          width: 300,
          height: 200,
        } as DOMRect;
      });
      openReceptionist('welcome');
    });
    afterEach(() => spy.mockRestore());

    it('nudges back inside the right edge after the view pans him there', async () => {
      const store = createViewportStore(1);
      render(
        <ViewportStoreProvider store={store}>
          <ReceptionistBubble head={{ x: 100, y: 100 }} feet={{ x: 100, y: 180 }} zoom={1} />
        </ViewportStoreProvider>,
        { container: root },
      );
      // 40..340 fits inside 16..374.
      expect(nudge()).toBe('');
      // The camera moves him 120 px right: 160..460, past the right edge.
      pan = 120;
      act(() => store.setOffset({ x: 120, y: 0 }));
      await frame();
      expect(nudge()).toBe('translateX(-86px)');
      // And back near the left edge: 16 px in from it.
      pan = -60;
      act(() => store.setOffset({ x: -60, y: 0 }));
      await frame();
      expect(nudge()).toBe('translateX(36px)');
    });

    it('nudges back inside after the window resizes, with no view to watch', async () => {
      render(<ReceptionistBubble head={{ x: 100, y: 100 }} feet={{ x: 100, y: 180 }} zoom={1} />, {
        container: root,
      });
      expect(nudge()).toBe('');
      pan = 100;
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      await frame();
      expect(nudge()).toBe('translateX(-66px)');
    });

    it('stops watching once it closes', async () => {
      const store = createViewportStore(1);
      const { rerender } = render(
        <ViewportStoreProvider store={store}>
          <ReceptionistBubble head={{ x: 100, y: 100 }} feet={{ x: 100, y: 180 }} zoom={1} />
        </ViewportStoreProvider>,
        { container: root },
      );
      act(() => resetReceptionistState());
      rerender(
        <ViewportStoreProvider store={store}>
          <ReceptionistBubble head={{ x: 100, y: 100 }} feet={{ x: 100, y: 180 }} zoom={1} />
        </ViewportStoreProvider>,
      );
      const calls = spy.mock.calls.length;
      act(() => store.setOffset({ x: 50, y: 0 }));
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      await frame();
      expect(spy.mock.calls.length).toBe(calls);
    });
  });
});
