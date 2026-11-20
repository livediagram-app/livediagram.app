// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openTabStyleFrom, registerTabStyleOpen } from '@/lib/tab-style-opener';
import { CanvasThemeDialog } from './CanvasThemeDialog';
import { onAnyPage } from '@liveworkspace/workbench/components/primitives/paged-carousel-testing';

// jsdom has no ResizeObserver; the dialog's animated height measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// docs/specs/011-theme/canvas-and-theme-dialog.md: a popover flying out of the paintbrush, else the centred dialog.
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const props: ComponentProps<typeof CanvasThemeDialog> = {
  tab: 'canvas',
  onTabChange: vi.fn(),
  backgroundPattern: 'grid' as const,
  backgroundColor: '#ffffff',
  patternColor: '#cccccc',
  backgroundOpacity: 1,
  backgroundPatternScale: 1,
  backgroundAnimationSpeed: 1,
  onSetBackgroundPattern: vi.fn(),
  onSetBackgroundColor: vi.fn(),
  onSetPatternColor: vi.fn(),
  onSetBackgroundOpacity: vi.fn(),
  onSetBackgroundPatternScale: vi.fn(),
  onSetBackgroundAnimationSpeed: vi.fn(),
  themeId: 'default',
  onSetTheme: vi.fn(),
  font: null,
  onSetFont: vi.fn(),
  defaultTextSize: undefined,
  onSetDefaultTextSize: vi.fn(),
  finish: undefined,
  onSetFinish: vi.fn(),
  onApplyLook: vi.fn(),
  onClose: vi.fn(),
  pages: {
    kind: 'slide',
    newPageBackground: undefined,
    themeId: 'default',
    units: 2,
    onSet: vi.fn(),
    onApplyToEveryPage: vi.fn(),
  },
};

describe('CanvasThemeDialog placement', () => {
  it('sits just above the paintbrush, right edges aligned', () => {
    Object.assign(window, { innerWidth: 1440, innerHeight: 900 });
    const brush = document.createElement('button');
    brush.setAttribute('data-tour-id', 'canvas-theme');
    brush.getBoundingClientRect = () =>
      ({ left: 1360, right: 1404, top: 840, bottom: 884, width: 44, height: 44 }) as DOMRect;
    document.body.appendChild(brush);
    render(<CanvasThemeDialog {...props} />);
    const panel = screen.getByRole('dialog', { name: 'Tab style' });
    expect(panel.style.right).toBe('36px');
    expect(panel.style.bottom).toBe('68px');
  });

  it("drops from a page's Style button, right edges aligned, over the brush", () => {
    Object.assign(window, { innerWidth: 1440, innerHeight: 900 });
    const brush = document.createElement('button');
    brush.setAttribute('data-tour-id', 'canvas-theme');
    brush.getBoundingClientRect = () =>
      ({ left: 1360, right: 1404, top: 840, bottom: 884, width: 44, height: 44 }) as DOMRect;
    document.body.appendChild(brush);
    const style = document.createElement('button');
    style.getBoundingClientRect = () =>
      ({ left: 900, right: 967, top: 120, bottom: 148, width: 67, height: 28 }) as DOMRect;
    document.body.appendChild(style);
    const undo = registerTabStyleOpen(() => {});
    openTabStyleFrom(style);
    render(<CanvasThemeDialog {...props} />);
    const panel = screen.getByRole('dialog', { name: 'Tab style' });
    expect(panel.style.right).toBe('473px');
    expect(panel.style.top).toBe('156px');
    expect(panel.style.bottom).toBe('');
    expect(panel.style.transformOrigin).toBe('right top');
    undo();
    style.remove();
    brush.remove();
  });

  it('is the centred dialog without a brush', () => {
    Object.assign(window, { innerWidth: 1440, innerHeight: 900 });
    render(<CanvasThemeDialog {...props} />);
    expect(screen.getByRole('dialog', { name: 'Tab style' }).style.right).toBe('');
  });
});

// docs/specs/008-canvas/finish.md "Where it is set": the Finish tab sets the tab's finish and clears every
// element's own.
describe('CanvasThemeDialog Finish tab', () => {
  it('is a Fine-tune row on the home that opens its panel', () => {
    const onTabChange = vi.fn();
    render(<CanvasThemeDialog {...props} tab="looks" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish: Flexible' }));
    expect(onTabChange).toHaveBeenCalledWith('finish');
  });

  it('presses Flexible for a tab without a finish, and sets the one clicked', () => {
    const onSetFinish = vi.fn();
    render(<CanvasThemeDialog {...props} tab="finish" onSetFinish={onSetFinish} />);
    expect(screen.getByRole('radio', { name: 'Flexible' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Sketch' }));
    expect(onSetFinish).toHaveBeenCalledWith('sketch');
  });

  it("presses the tab's finish", () => {
    render(<CanvasThemeDialog {...props} tab="finish" finish="professional" />);
    expect(screen.getByRole('radio', { name: 'Professional' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('previews the chosen finish on a sample diagram', () => {
    const { rerender } = render(<CanvasThemeDialog {...props} tab="finish" />);
    const preview = screen.getByRole('img', { name: /Flexible finish/ });
    expect(preview.getAttribute('data-finish-preview')).toBe('flexible');
    expect(preview.querySelector('svg')).not.toBeNull();
    rerender(<CanvasThemeDialog {...props} tab="finish" finish="sketch" />);
    expect(screen.getByRole('img', { name: /Sketch finish/ }).innerHTML).toContain(
      'data-finish="sketch"',
    );
  });
});

// docs/specs/011-theme/canvas-and-theme-dialog.md "Looks", "Fine-tune": the home, its looks and its panels.
describe('CanvasThemeDialog home', () => {
  const home = (over: Partial<ComponentProps<typeof CanvasThemeDialog>> = {}) =>
    render(<CanvasThemeDialog {...props} tab="looks" {...over} />);
  // A look's card on whichever page holds it (the carousel mounts only the page on show and its neighbours).
  const lookCard = (name: string) =>
    onAnyPage(
      'Looks',
      () => screen.queryByRole('button', { name: new RegExp(`^${name}`) }),
      fireEvent.click,
    );
  const lookNames = [
    'Everyday',
    'Boardroom',
    'Spectrum',
    'Editorial',
    'Notebook',
    'Midnight',
    'Daydream',
    'Studio',
    'Seaside',
    'Textbook',
    'Lagoon',
    'Garden',
    'Sketchbook',
    'Night Shift',
    'Workshop',
    'Billboard',
    'Classroom',
  ];

  it('offers the seventeen looks, each drawn as a preview', () => {
    home();
    for (const name of lookNames) {
      const card = lookCard(name);
      expect(card?.querySelector('svg'), name).not.toBeNull();
    }
  });

  it('pages the Mashup card and the looks in a carousel of three pages, opening on the current look’s page', () => {
    const { unmount } = home({ themeId: 'brand', finish: undefined, font: null });
    const next = screen.getByRole('button', { name: 'Next looks' });
    const prev = screen.getByRole('button', { name: 'Previous looks' });
    expect(prev.hasAttribute('disabled')).toBe(true);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(next.hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Looks page 3 of 3' }).getAttribute('aria-current'),
    ).toBe('true');
    unmount();
    // A tab on a page-two look opens there (the Mashup card leads page one).
    home({
      themeId: 'lavender',
      finish: 'professional',
      font: 'roboto-slab',
      backgroundPattern: 'blank',
    });
    expect(
      screen.getByRole('button', { name: 'Looks page 2 of 3' }).getAttribute('aria-current'),
    ).toBe('true');
  });

  it('shows only the looks, with no Current card for the tab’s own mix', () => {
    home({ themeId: 'rose', finish: 'sketch', font: 'lora', backgroundPattern: 'lines' });
    expect(screen.queryByRole('button', { name: /^Current/ })).toBeNull();
  });

  it('applies a look on click', () => {
    const onApplyLook = vi.fn();
    home({ onApplyLook });
    fireEvent.click(screen.getByRole('button', { name: /^Boardroom/ }));
    expect(onApplyLook).toHaveBeenCalledWith('boardroom');
  });

  it('marks the look the tab matches, and none for its own mix', () => {
    const { unmount } = home({ themeId: 'brand', finish: undefined, font: null });
    expect(screen.getByRole('button', { name: /^Everyday/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    unmount();
    home({ themeId: 'brand', finish: 'sketch', font: null });
    for (const name of lookNames)
      expect(lookCard(name)?.getAttribute('aria-pressed')).toBe('false');
  });

  it('shows each setting’s current value on its Fine-tune row and opens its panel', () => {
    const onTabChange = vi.fn();
    home({
      onTabChange,
      finish: 'professional',
      font: 'inter',
      defaultTextSize: 'lg',
      backgroundPattern: 'lines',
    });
    expect(screen.getByRole('button', { name: /^Colours: / })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Finish: Professional' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Text: Inter, large/ }));
    expect(onTabChange).toHaveBeenLastCalledWith('font');
    fireEvent.click(
      screen.getByRole('button', { name: 'New Page Background: Like the page before' }),
    );
    expect(onTabChange).toHaveBeenLastCalledWith('canvas');
    fireEvent.click(screen.getByRole('button', { name: /^Colours: / }));
    expect(onTabChange).toHaveBeenLastCalledWith('theme');
  });

  it('has no breadcrumb on the home; a panel’s shared breadcrumb names it and goes back', () => {
    const { unmount } = home();
    expect(screen.queryByRole('button', { name: /^Tab Style/ })).toBeNull();
    unmount();
    const onTabChange = vi.fn();
    render(<CanvasThemeDialog {...props} tab="font" onTabChange={onTabChange} />);
    const crumb = screen.getByRole('button', { name: /^Tab Style/ });
    expect(crumb.textContent).toContain('Text');
    fireEvent.click(crumb);
    expect(onTabChange).toHaveBeenCalledWith('looks');
  });
});

// docs/specs/011-theme/canvas-and-theme-dialog.md "Apply to All Tabs": the home's last row, an Editor's only.
describe('CanvasThemeDialog Apply to All Tabs', () => {
  const row = () => screen.queryByRole('button', { name: /Apply to All Tabs/ });

  it('ends the home with the row for an Editor, applying on a press', () => {
    const onApply = vi.fn();
    render(
      <CanvasThemeDialog
        {...props}
        tab="looks"
        allTabs={{ tabCount: 3, applying: false, onApply }}
      />,
    );
    fireEvent.click(row()!);
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('leaves the row out for anyone the editor does not offer it to (Participant, Viewer, a scoped session)', () => {
    render(<CanvasThemeDialog {...props} tab="looks" />);
    expect(row()).toBeNull();
  });

  it('shows the row on the home only, not inside a panel', () => {
    render(
      <CanvasThemeDialog
        {...props}
        tab="canvas"
        allTabs={{ tabCount: 3, applying: false, onApply: vi.fn() }}
      />,
    );
    expect(row()).toBeNull();
  });
});

// docs/specs/011-theme/canvas-and-theme-dialog.md "New Page Background": the Canvas panel's place.
describe('CanvasThemeDialog New Page Background', () => {
  const mint = { kind: 'solid' as const, color: '#ccfbf1' };
  const panel = (pages: Partial<ComponentProps<typeof CanvasThemeDialog>['pages']> = {}) => {
    const all = { ...props.pages, onSet: vi.fn(), onApplyToEveryPage: vi.fn(), ...pages };
    render(<CanvasThemeDialog {...props} tab="canvas" pages={all} />);
    return all;
  };

  it('carries over the page before until Choose One starts on the paper', () => {
    const pages = panel();
    expect(document.querySelector('[data-new-page-background-all]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Choose One/ }));
    expect(pages.onSet).toHaveBeenCalledWith({});
  });

  it('with one chosen, offers the background and Apply to Every Page, and Like the Page Before clears it', () => {
    const pages = panel({ newPageBackground: { fill: mint } });
    fireEvent.click(document.querySelector('[data-new-page-background-all]')!);
    expect(pages.onApplyToEveryPage).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Gives the 2 pages this background/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Like the Page Before/ }));
    expect(pages.onSet).toHaveBeenCalledWith(null);
  });

  it('sets the surround’s pattern from Around the Pages, which an article leaves out', () => {
    const onSetBackgroundPattern = vi.fn();
    const { unmount } = render(
      <CanvasThemeDialog {...props} tab="canvas" onSetBackgroundPattern={onSetBackgroundPattern} />,
    );
    const group = screen.getByRole('group', { name: 'Pattern around the pages' });
    fireEvent.click(within(group).getByRole('button', { name: /Lines/ }));
    expect(onSetBackgroundPattern).toHaveBeenCalledWith('lines');
    unmount();
    panel({ kind: 'article' });
    expect(screen.queryByRole('group', { name: 'Pattern around the pages' })).toBeNull();
  });

  it('previews on a page wearing the background new pages start on, and names it on the home', () => {
    const { unmount } = render(
      <CanvasThemeDialog
        {...props}
        tab="finish"
        pages={{ ...props.pages, newPageBackground: { fill: mint } }}
      />,
    );
    const preview = screen.getByRole('img', { name: /sample page/ });
    expect(preview.getAttribute('data-preview-page')).toBe('slide');
    expect(preview.innerHTML.toLowerCase()).toContain('#ccfbf1');
    unmount();
    render(
      <CanvasThemeDialog
        {...props}
        tab="looks"
        pages={{ ...props.pages, newPageBackground: { fill: mint, pattern: 'dots' } }}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'New Page Background: Solid colour, dots' }),
    ).toBeTruthy();
  });
});

// docs/specs/011-theme/canvas-and-theme-dialog.md "Articles": an article or a card styles its colours and pages here.
describe('CanvasThemeDialog on an article', () => {
  it('offers Colours and the background only, and opens the article’s own Style', () => {
    const onOpenArticleStyle = vi.fn();
    render(
      <CanvasThemeDialog
        {...props}
        tab="looks"
        surface="article"
        pages={{ ...props.pages, kind: 'article', onOpenArticleStyle }}
      />,
    );
    expect(screen.queryByRole('button', { name: /^Finish: / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Text: / })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Article Style/ }));
    expect(onOpenArticleStyle).toHaveBeenCalledTimes(1);
  });

  it('names the row Card Style on a card', () => {
    render(
      <CanvasThemeDialog
        {...props}
        tab="looks"
        surface="flashcard"
        pages={{ ...props.pages, kind: 'flashcard', onOpenArticleStyle: vi.fn() }}
      />,
    );
    expect(screen.getByRole('button', { name: /Card Style/ })).toBeTruthy();
  });
});
