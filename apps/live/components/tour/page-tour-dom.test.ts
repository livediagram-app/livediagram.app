// @vitest-environment jsdom
// The page tour's DOM (docs/specs/007-editor/pages-tour.md "The steps"): a popover opened once per step by its
// real button and closed only if the step opened it, and the + the Add step points at.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addPageAnchor, closeTitlePopover, openTitlePopover, resetPageTour } from './page-tour-dom';

vi.mock('./tour-dom', () => ({ waitForSelector: async () => null }));

afterEach(() => {
  document.body.innerHTML = '';
  resetPageTour();
});

function place(html: string, rect?: [number, number, number, number]): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  const el = host.firstElementChild as HTMLElement;
  if (rect) {
    const [left, top, width, height] = rect;
    el.getBoundingClientRect = () =>
      ({ left, top, right: left + width, bottom: top + height, width, height }) as DOMRect;
  }
  document.body.append(el);
  return el;
}

describe('addPageAnchor', () => {
  it('points at the + after the last page while it is in the window', () => {
    place('<button data-tour-id="add-page"></button>', [600, 300, 36, 36]);
    place('<button data-tour-id="add-page-strip"></button>', [900, 80, 36, 36]);
    expect(addPageAnchor()).toBe('[data-tour-id="add-page"]');
  });

  it('falls back to the Toolbar strip’s + when that one is off screen', () => {
    place('<button data-tour-id="add-page"></button>', [5000, 300, 36, 36]);
    place('<button data-tour-id="add-page-strip"></button>', [900, 80, 36, 36]);
    expect(addPageAnchor()).toBe('[data-tour-id="add-page-strip"]');
  });

  it('has none when neither is in the window (a phone)', () => {
    place('<button data-tour-id="add-page"></button>', [5000, 300, 36, 36]);
    expect(addPageAnchor()).toBeNull();
  });
});

describe('title popovers', () => {
  const page = () => {
    place(
      '<div data-page-id="p1"><button aria-label="Layout" aria-expanded="false"></button></div>',
    );
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Layout"]')!;
    const click = vi.fn(() =>
      button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true')),
    );
    button.addEventListener('click', click);
    return { button, click };
  };

  it('opens once per step, so a pick that closed it is not undone', async () => {
    const { button, click } = page();
    await openTitlePopover('p1', 'Layout');
    expect(click).toHaveBeenCalledTimes(1);
    button.setAttribute('aria-expanded', 'false'); // a pick closed it
    await openTitlePopover('p1', 'Layout');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('closes what it opened, and never one it did not open', async () => {
    const { button, click } = page();
    closeTitlePopover('p1', 'Layout');
    expect(click).not.toHaveBeenCalled();
    await openTitlePopover('p1', 'Layout');
    closeTitlePopover('p1', 'Layout');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(click).toHaveBeenCalledTimes(2);
  });
});
