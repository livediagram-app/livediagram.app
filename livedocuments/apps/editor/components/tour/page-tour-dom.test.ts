// @vitest-environment jsdom
// The page tour's DOM (docs/specs/007-editor/pages-tour.md "The steps"): a popover opened once per step by its
// real button and closed only if the step opened it, and the + the Add step points at.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addPageAnchor,
  addPageRequires,
  addPageTarget,
  closeContents,
  closeTitlePopover,
  contentsRequires,
  firstBlockOnPage,
  openContents,
  openTitlePopover,
  pageLook,
  pageOrPopover,
  prepareAddPage,
  resetPageTour,
  tidyPageTour,
} from './page-tour-dom';

// jsdom lays nothing out: what is in the document counts as shown.
vi.mock('@liveworkspace/workbench/components/tour/tour-dom', () => ({
  waitForSelector: async (selector: string) => document.querySelector(selector),
  isOnScreen: (selector: string) => document.querySelector(selector) !== null,
}));

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

// docs/specs/007-editor/pages-tour.md "On a phone": the looks under Appearance, Contents behind its button.
describe('a phone’s Appearance', () => {
  // A phone's title bar: Appearance alone, its sheet's rows opening each control's own sheet.
  const phonePage = () => {
    place(
      '<div data-page-id="p1"><button aria-label="Appearance" aria-expanded="false"></button></div>',
    );
    const appearance = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Appearance"]',
    )!;
    const sheet = (name: string, inner = '') => {
      const el = place(
        `<div role="dialog" aria-label="${name}" data-bottom-sheet="">${inner}</div>`,
      );
      return el;
    };
    const rows: string[] = [];
    appearance.addEventListener('click', () => {
      appearance.setAttribute('aria-expanded', 'true');
      const list = sheet(
        'Appearance',
        '<button data-appearance-row="layout"></button><button data-appearance-row="background"></button>',
      );
      for (const row of list.querySelectorAll<HTMLButtonElement>('button')) {
        row.addEventListener('click', () => {
          rows.push(row.dataset.appearanceRow!);
          list.remove();
          appearance.setAttribute('aria-expanded', 'false');
          sheet(row.dataset.appearanceRow === 'layout' ? 'Layout' : 'Background');
        });
      }
    });
    // An outside press closes every open sheet (useClickOutside, on the window in the capture phase).
    const outside = vi.fn(() => {
      for (const el of document.querySelectorAll('[data-bottom-sheet]')) el.remove();
    });
    window.addEventListener('pointerdown', outside, true);
    return {
      appearance,
      rows,
      outside,
      done: () => window.removeEventListener('pointerdown', outside, true),
    };
  };

  it('needs the control’s own button or Appearance', () => {
    expect(pageLook('p1', 'Layout')).toBe(
      '[data-page-id="p1"] button[aria-label="Layout"], [data-page-id="p1"] button[aria-label="Appearance"]',
    );
  });

  it('opens the control through Appearance’s row, and rings its sheet', async () => {
    const { rows, done } = phonePage();
    expect(pageOrPopover('p1', 'Layout')).toBe(
      '[data-page-id="p1"] button[aria-label="Appearance"]',
    );
    await openTitlePopover('p1', 'Layout');
    expect(rows).toEqual(['layout']);
    expect(pageOrPopover('p1', 'Layout')).toBe(
      '[role="dialog"][aria-label="Layout"]:is([data-anchored-popover], [data-bottom-sheet])',
    );
    done();
  });

  it('closes the sheet it opened by a press outside, and only one it opened', async () => {
    const { outside, done } = phonePage();
    closeTitlePopover('p1', 'Background');
    expect(outside).not.toHaveBeenCalled();
    await openTitlePopover('p1', 'Background');
    expect(document.querySelector('[aria-label="Background"]')).not.toBeNull();
    closeTitlePopover('p1', 'Background');
    expect(outside).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-bottom-sheet]')).toBeNull();
    done();
  });

  it('closes Appearance’s own sheet when its row never opened', async () => {
    const { appearance, outside, done } = phonePage();
    await openTitlePopover('p1', 'Style'); // a slide's Appearance has no Style row
    expect(appearance.getAttribute('aria-expanded')).toBe('true');
    tidyPageTour('p1');
    expect(outside).toHaveBeenCalledOnce();
    done();
  });

  it('does nothing on a page with neither the control nor Appearance', async () => {
    place('<div data-page-id="p1"></div>');
    await openTitlePopover('p1', 'Layout');
    closeTitlePopover('p1', 'Layout');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('stops when Appearance’s sheet never shows the row', async () => {
    place(
      '<div data-page-id="p1"><button aria-label="Appearance" aria-expanded="true"></button></div>',
    );
    await openTitlePopover('p1', 'Layout');
    expect(document.querySelector('[aria-label="Layout"]')).toBeNull();
  });
});

describe('Contents from its button', () => {
  const contents = () => {
    const button = place('<button data-tour-id="contents" aria-expanded="false"></button>');
    const click = vi.fn(() => {
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      if (open) document.querySelector('[data-contents-sheet]')?.remove();
      else
        place(
          '<div data-contents-sheet=""><div data-contents-slot="0"><button data-page-row="p1"></button></div><button data-contents-add=""></button></div>',
        );
    });
    button.addEventListener('click', click);
    return { button, click };
  };

  it('needs the row, else the button', () => {
    expect(contentsRequires('p1')).toBe(
      '[data-contents-slot]:has([data-page-row="p1"]), [data-tour-id="contents"]',
    );
  });

  it('opens it for the row, and closes only what it opened', async () => {
    const { click } = contents();
    closeContents();
    expect(click).not.toHaveBeenCalled();
    await openContents('p1');
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-page-row="p1"]')).not.toBeNull();
    // Open already: the next step leaves it be.
    await openContents('p1');
    expect(click).toHaveBeenCalledOnce();
    closeContents();
    expect(click).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-page-row="p1"]')).toBeNull();
  });

  it('leaves the docked sidebar, and a Contents someone else opened, as they are', async () => {
    const { button, click } = contents();
    button.setAttribute('aria-expanded', 'true');
    await openContents('p1');
    closeContents();
    expect(click).not.toHaveBeenCalled();
    place('<div data-contents-slot="0"><button data-page-row="p2"></button></div>');
    await openContents('p2');
    expect(click).not.toHaveBeenCalled();
  });

  it('has nothing to open with no button (zen mode)', async () => {
    await openContents('p1');
    expect(document.querySelector('[data-page-row]')).toBeNull();
  });

  it('is where the Add step points when no + is in the window', async () => {
    place('<button data-tour-id="add-page"></button>', [5000, 300, 36, 36]);
    const { click } = contents();
    expect(addPageTarget()).toBeNull();
    expect(addPageRequires()).toBe('[data-contents-add], [data-tour-id="contents"]');
    await prepareAddPage('p1');
    expect(click).toHaveBeenCalledOnce();
    expect(addPageTarget()).toBe('[data-contents-add]');
  });

  it('stays shut while the + is in the window', async () => {
    place('<button data-tour-id="add-page"></button>', [300, 300, 36, 36]);
    const { click } = contents();
    expect(addPageRequires()).toBe('[data-tour-id="add-page"]');
    await prepareAddPage('p1');
    expect(click).not.toHaveBeenCalled();
    expect(addPageTarget()).toBe('[data-tour-id="add-page"]');
  });
});

describe('firstBlockOnPage', () => {
  // Two pages side by side; the writing one editable across both.
  const article = () => {
    place('<div data-page-id="p1"></div>', [0, 0, 400, 600]);
    place('<div data-page-id="p2"></div>', [440, 0, 400, 600]);
    const flow = place('<div data-article-flow="a1"></div>');
    const block = (id: string, rect: [number, number, number, number]) => {
      const [left, top, width, height] = rect;
      const el = document.createElement('p');
      el.setAttribute('data-block-id', id);
      el.getBoundingClientRect = () =>
        ({ left, top, right: left + width, bottom: top + height, width, height }) as DOMRect;
      flow.append(el);
    };
    block('b1', [40, 40, 320, 20]);
    block('b2', [40, 70, 320, 20]);
    block('b3', [480, 40, 320, 20]);
  };

  it('rings the first block on the tour page', () => {
    article();
    expect(firstBlockOnPage('p1')).toBe('[data-article-flow] [data-block-id="b1"]');
    expect(firstBlockOnPage('p2')).toBe('[data-article-flow] [data-block-id="b3"]');
  });

  it('has none for a page with no writing on it, or no page', () => {
    article();
    place('<div data-page-id="p3"></div>', [880, 0, 400, 600]);
    expect(firstBlockOnPage('p3')).toBeNull();
    expect(firstBlockOnPage('gone')).toBeNull();
  });
});
