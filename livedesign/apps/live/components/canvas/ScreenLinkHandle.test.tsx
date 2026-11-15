// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { layOutPages, type Page } from '@livedesign/design';
import {
  dropTarget,
  SCREEN_LINK_DRAG_SLOP_PX,
  SCREEN_LINK_HANDLE_GAP_PX,
  SCREEN_LINK_HANDLE_PX,
  ScreenLinkHandle,
} from './ScreenLinkHandle';

// docs/specs/007-editor/wireframe-pages.md "Setting a link": the link handle's drag onto a screen.
const wire = (id: string, name?: string): Page => ({
  id,
  orientation: 'portrait',
  kind: 'wireframe',
  device: 'iphone',
  ...(name ? { name } : {}),
});
const pages = layOutPages([wire('page-1'), wire('page-2', 'Checkout')]);
const [first, second] = pages as [(typeof pages)[0], (typeof pages)[0]];
const bounds = { x: first.rect.x + 10, y: first.rect.y + 10, width: 40, height: 20 };
// The handle's centre in canvas coords at zoom 1.
const reach = SCREEN_LINK_HANDLE_GAP_PX + SCREEN_LINK_HANDLE_PX / 2;
const hx = bounds.x + bounds.width + reach;
const hy = bounds.y + bounds.height + reach;

const middleOf = (r: { x: number; y: number; width: number; height: number }) => ({
  x: r.x + r.width / 2,
  y: r.y + r.height / 2,
});
const clientOf = (p: { x: number; y: number }) => ({ clientX: p.x, clientY: p.y });

function mount(zoom = 1) {
  const onLink = vi.fn();
  const onPick = vi.fn();
  render(
    <ScreenLinkHandle
      elementId="el"
      bounds={bounds}
      zoom={zoom}
      pages={pages}
      ownPageId="page-1"
      onLink={onLink}
      onPick={onPick}
    />,
  );
  return { onLink, onPick, handle: screen.getByRole('button', { name: 'Link to a screen' }) };
}

// A drag from the handle to a canvas point (zoom 1: client travel equals canvas travel).
function dragTo(handle: HTMLElement, to: { x: number; y: number }, release = true) {
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: hx, clientY: hy });
  fireEvent.pointerMove(handle, { pointerId: 1, ...clientOf(to) });
  if (release) {
    fireEvent.pointerUp(handle, { pointerId: 1, ...clientOf(to) });
    fireEvent.click(handle);
  }
}

describe('ScreenLinkHandle', () => {
  it('links the element to the screen it is dropped on, naming it while over it', () => {
    const { onLink, onPick, handle } = mount();
    dragTo(handle, middleOf(second.rect), false);
    expect(screen.getByText('Link to Checkout')).toBeTruthy();
    fireEvent.pointerUp(handle, { pointerId: 1, ...clientOf(middleOf(second.rect)) });
    fireEvent.click(handle);
    expect(onLink).toHaveBeenCalledWith('el', 'page-2');
    // The release's click never opens the menu over the link just made.
    expect(onPick).not.toHaveBeenCalled();
    expect(document.querySelector('[data-screen-link-drag]')).toBeNull();
  });

  it('changes nothing dropped on its own screen or off every screen', () => {
    const { onLink, handle } = mount();
    dragTo(handle, middleOf(first.rect));
    dragTo(handle, { x: -9000, y: -9000 });
    expect(onLink).not.toHaveBeenCalled();
  });

  it('drops the drag on Escape', () => {
    const { onLink, handle } = mount();
    dragTo(handle, middleOf(second.rect), false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByText('Link to Checkout')).toBeNull();
    fireEvent.pointerUp(handle, { pointerId: 1, ...clientOf(middleOf(second.rect)) });
    expect(onLink).not.toHaveBeenCalled();
  });

  it('drops the drag when the pointer is cancelled or its capture lost', () => {
    const { onLink, handle } = mount();
    dragTo(handle, middleOf(second.rect), false);
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    expect(document.querySelector('[data-screen-link-drag]')).toBeNull();
    dragTo(handle, middleOf(second.rect), false);
    fireEvent(handle, new Event('lostpointercapture', { bubbles: true }));
    expect(document.querySelector('[data-screen-link-drag]')).toBeNull();
    expect(onLink).not.toHaveBeenCalled();
  });

  it('opens the Screen mode on a press without a drag, or a click from the keys', () => {
    const { onLink, onPick, handle } = mount();
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: hx, clientY: hy });
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: hx + SCREEN_LINK_DRAG_SLOP_PX - 1,
      clientY: hy,
    });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: hx, clientY: hy });
    fireEvent.click(handle);
    expect(onPick).toHaveBeenCalledWith('el');
    expect(onLink).not.toHaveBeenCalled();
    // A secondary button and a stray move without a press do nothing.
    fireEvent.pointerDown(handle, { button: 2, pointerId: 1 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(onLink).not.toHaveBeenCalled();
  });

  it('follows the zoom: the client travel over the zoom is the canvas travel', () => {
    const { onLink, handle } = mount(2);
    const target = middleOf(second.rect);
    // At zoom 2 the handle sits half its screen reach past the corner.
    const zx = bounds.x + bounds.width + reach / 2;
    const zy = bounds.y + bounds.height + reach / 2;
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    const client = { clientX: (target.x - zx) * 2, clientY: (target.y - zy) * 2 };
    fireEvent.pointerMove(handle, { pointerId: 1, ...client });
    fireEvent.pointerUp(handle, { pointerId: 1, ...client });
    expect(onLink).toHaveBeenCalledWith('el', 'page-2');
  });
});

describe('dropTarget', () => {
  it('answers a page of the tab, never the element own', () => {
    expect(dropTarget(pages, middleOf(second.rect), 'page-1')?.id).toBe('page-2');
    expect(dropTarget(pages, middleOf(first.rect), 'page-1')).toBeNull();
    expect(dropTarget(pages, middleOf(first.rect), undefined)?.id).toBe('page-1');
    expect(dropTarget(pages, { x: -9000, y: 0 }, 'page-1')).toBeNull();
  });
});
