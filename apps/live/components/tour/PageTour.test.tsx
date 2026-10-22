// @vitest-environment jsdom
// Show Me on a page (docs/specs/007-editor/pages-tour.md, show-me.md, logo-pages.md "Show Me"): every page's panel
// runs its kind's track on that page, opening the real controls a step is about and closing them again.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readPinnedPageToolbar } from '@/components/canvas/article/page-toolbar-presence';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, pageKindOf, type Page } from '@liveplanner/document';
import type { PageEdits } from '@/hooks/editor/usePagesMode';
import { useFollowPagePanelRequests } from '@/lib/page-panel-request';
import { track } from '@/lib/telemetry';
import { PagePanel, type PagePanelTab } from '@/components/canvas/PagePanel';
import { PAGE_TOUR_HELP, PageShowMeButton, PageTourStage, usePageTour } from './PageTour';
import { registerCombineDemo } from './logo-combine-demo';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// jsdom lays nothing out, so "on screen" is just "in the document" here.
vi.mock('./tour-dom', async (actual) => ({
  ...(await actual<typeof import('./tour-dom')>()),
  waitForSelector: async (selector: string) => document.querySelector<HTMLElement>(selector),
  isOnScreen: (selector: string) => document.querySelector(selector) !== null,
}));
afterEach(() => {
  cleanup();
  registerCombineDemo(null);
  vi.mocked(track).mockClear();
});

const page = (kind: Page['kind'], over: Partial<Page> = {}): Page => ({
  id: `${kind}-1`,
  orientation: kind === 'slide' ? 'landscape' : 'portrait',
  kind,
  ...(kind === 'logo' ? { size: 'logo' as const } : {}),
  ...(kind === 'article' ? { flow: 'f1' } : {}),
  ...over,
});

const edits = (): PageEdits =>
  ({
    rename: vi.fn(),
    setBackground: vi.fn(),
    applyToAllReach: vi.fn(() => 0),
    applyBackgroundToAll: vi.fn(),
    copyBackground: vi.fn(() => false),
    setSize: vi.fn(),
    setOrientation: vi.fn(),
    canDuplicate: () => true,
    canMove: () => false,
    applyLayout: vi.fn(),
    contentCount: () => 0,
    isLocked: () => false,
    removePage: vi.fn(),
  }) as unknown as PageEdits;

// A title-bar popover, cut down: its button toggles it, and a pick closes it.
function TitlePopover({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label={name} aria-expanded={open} onClick={() => setOpen(!open)} />
      {open ? (
        <div role="dialog" aria-label={name} data-anchored-popover="">
          <button type="button" onClick={() => setOpen(false)}>
            Pick {name}
          </button>
        </div>
      ) : null}
    </>
  );
}

// CanvasPages' wiring, cut down: the page and its title bar, the +, its panel, and the tour.
function Page({ of, deleted = false }: { of: Page; deleted?: boolean }) {
  const [opened, setOpened] = useState<{ id: string; tab: PagePanelTab; seq?: number } | null>({
    id: of.id,
    tab: of.kind === 'logo' ? 'background' : 'page',
  });
  useFollowPagePanelRequests(setOpened);
  const { tour, kind, freeze } = usePageTour((id) => id === of.id && !deleted);
  const laid = layOutPages([of])[0]!;
  const ofKind = pageKindOf(of);
  return (
    <div>
      {deleted ? null : (
        <div data-page-id={of.id} data-page-kind={ofKind}>
          <button type="button" data-tour-id="page-name">
            Page
          </button>
          <TitlePopover name="Layout" />
          <TitlePopover name="Background" />
          <TitlePopover name="Style" />
          <TitlePopover name="Text" />
          <button type="button" data-tour-id="page-cog" aria-label="Page settings" />
          <div data-logo-title-bar={of.id}>
            <button type="button" aria-label="Mirror" />
            <button type="button" aria-label="Guides" />
          </div>
        </div>
      )}
      <button type="button" data-tour-id="add-page" aria-label="Add Page" />
      {opened && !deleted ? (
        <PagePanel
          key={opened.seq ?? 0}
          page={laid}
          count={1}
          getAnchor={() => undefined}
          initialTab={opened.tab}
          themeBackgrounds={[]}
          edit={edits()}
          onPreview={vi.fn()}
          onLayoutPreview={vi.fn()}
          onClose={() => setOpened(null)}
          showMe={{
            button: (
              <PageShowMeButton tour={tour} kind={ofKind} onStart={() => freeze(of.id, ofKind)} />
            ),
            article: PAGE_TOUR_HELP[ofKind].article,
          }}
        />
      ) : null}
      <PageTourStage tour={tour} kind={kind} />
    </div>
  );
}

const settle = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const next = async () => {
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  await settle();
};
// The steps load at the press: wait for the first step card.
const showMe = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
  await waitFor(() => expect(screen.getByRole('dialog', { name: /^Show Me step 1/ })).toBeTruthy());
  await settle();
};
const stepDialog = (title: RegExp) => screen.getByRole('dialog', { name: title });
// Under load a step lands a beat after Next: wait for what it shows.
const shows = (check: () => void) => waitFor(check);
const popover = (name: string) =>
  document.querySelector(`[role="dialog"][aria-label="${name}"][data-anchored-popover]`);

describe('Show Me on every page', () => {
  it.each([
    ['slide', '/help/canvas/pages-mode/slide-pages/'],
    ['infographic', '/help/canvas/pages-mode/infographic-layouts/'],
    ['article', '/help/canvas/pages-mode/articles/'],
    ['logo', '/help/canvas/pages-mode/logo-pages/'],
  ] as const)('heads a %s page’s panel beside its own Help', (kind, href) => {
    render(<Page of={page(kind)} />);
    expect(screen.getByRole('button', { name: 'Show Me' })).toBeTruthy();
    const help = document.querySelector<HTMLAnchorElement>('[data-page-panel] a[href]');
    expect(help?.getAttribute('href')).toBe(href);
  });
});

describe('a slide’s Show Me', () => {
  it('opens Layout, then Background, then points at the +', async () => {
    render(<Page of={page('slide')} />);
    await showMe();
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'SlideTour');
    // The panel it was pressed in makes way for the page.
    await shows(() => expect(document.querySelector('[data-page-panel]')).toBeNull());
    await shows(() => expect(stepDialog(/^Show Me step 1 of 3: Choose a Layout/)).toBeTruthy());
    await shows(() => expect(popover('Layout')).not.toBeNull());
    await next();
    await shows(() => expect(popover('Layout')).toBeNull());
    await shows(() => expect(stepDialog(/Change the Background/)).toBeTruthy());
    await shows(() => expect(popover('Background')).not.toBeNull());
    await next();
    await shows(() => expect(popover('Background')).toBeNull());
    await shows(() => expect(stepDialog(/Add Another Slide/)).toBeTruthy());
    await next();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'SlideTourCompleted');
  });

  it('keeps a pick, and never reopens the popover it closed', async () => {
    render(<Page of={page('slide')} />);
    await showMe();
    // The tour's card is modal to assistive tech, so the popover's pick is pressed by its node.
    fireEvent.click(popover('Layout')!.querySelector('button')!);
    // Past the engine's tracking tick, which re-prepares a step whose target went.
    await settle(400);
    await shows(() => expect(popover('Layout')).toBeNull());
    await shows(() => expect(stepDialog(/Choose a Layout/)).toBeTruthy());
  });

  it('closes what it opened when skipped', async () => {
    render(<Page of={page('slide')} />);
    await showMe();
    await shows(() => expect(popover('Layout')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await settle();
    await shows(() => expect(popover('Layout')).toBeNull());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'SlideTourSkipped');
  });
});

describe('an infographic’s Show Me', () => {
  it('opens the page’s panel on Page for its size, and closes it after', async () => {
    render(<Page of={page('infographic')} />);
    await showMe();
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'InfographicTour');
    await shows(() => expect(stepDialog(/^Show Me step 1 of 5: Your Page/)).toBeTruthy());
    await next(); // Layout
    await next(); // Background
    await next();
    await shows(() => expect(stepDialog(/Page Size/)).toBeTruthy());
    await shows(() => expect(document.querySelector('[data-page-panel]')).not.toBeNull());
    await next();
    await shows(() => expect(document.querySelector('[data-page-panel]')).toBeNull());
    await shows(() => expect(stepDialog(/Add a Page/)).toBeTruthy());
  });
});

describe('an article’s Show Me', () => {
  it('holds the page toolbar up on its step, then opens Style and Text beside the cog', async () => {
    render(<Page of={page('article')} />);
    // The toolbar as PageToolbar draws it; the step pins it to the tour page (it shows on hover otherwise).
    const bar = document.createElement('div');
    bar.setAttribute('data-page-toolbar', '');
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Article Formatting');
    document.body.append(bar);
    await showMe();
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'ArticleTour');
    await shows(() => expect(stepDialog(/Write on the Page/)).toBeTruthy());
    await next();
    await shows(() => expect(stepDialog(/The Page Toolbar/)).toBeTruthy());
    expect(readPinnedPageToolbar()).not.toBeNull();
    await next();
    await shows(() => expect(readPinnedPageToolbar()).toBeNull());
    bar.remove();
    await shows(() => expect(stepDialog(/Article Style/)).toBeTruthy());
    expect(document.querySelector('[role="dialog"][aria-label="Style"]')).not.toBeNull();
    await next();
    await shows(() => expect(stepDialog(/Fonts and Spacing/)).toBeTruthy());
    await shows(() =>
      expect(document.querySelector('[role="dialog"][aria-label="Style"]')).toBeNull(),
    );
    expect(document.querySelector('[role="dialog"][aria-label="Text"]')).not.toBeNull();
    await next();
    await shows(() =>
      expect(document.querySelector('[role="dialog"][aria-label="Text"]')).toBeNull(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'ArticleTourCompleted');
  });
});

describe('a logo page’s Show Me', () => {
  it('reopens the panel on Layouts, then closes it for the title bar’s steps', async () => {
    // The editor's side of the Combine demonstration, cut down: placing shows Combine, uniting leaves one shape.
    const placed: HTMLElement[] = [];
    const add = (el: HTMLElement) => (placed.push(el), document.body.append(el));
    let shape: string | null = null;
    const clear = vi.fn(() => {
      for (const el of placed.splice(0)) el.remove();
      shape = null;
    });
    registerCombineDemo({
      place: async () => {
        const combine = document.createElement('button');
        combine.setAttribute('aria-label', 'Combine shapes');
        add(combine);
        return true;
      },
      unite: async () => {
        const united = document.createElement('div');
        united.setAttribute('data-element-id', 'united');
        add(united);
        shape = 'united';
        return true;
      },
      clear,
      shape: () => shape,
    });
    render(<Page of={page('logo')} />);
    await showMe();
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'LogoTour');
    await shows(() =>
      expect(stepDialog(/^Show Me step 1 of 6: Start From a Logo Layout/)).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: 'Layouts' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    await next();
    expect(screen.queryByRole('textbox', { name: 'Page name' })).toBeNull();
    await shows(() => expect(stepDialog(/Draw on Guides/)).toBeTruthy());
    await next();
    await shows(() => expect(stepDialog(/Mirror As You Draw/)).toBeTruthy());
    await next();
    await shows(() => expect(stepDialog(/Combine Shapes/)).toBeTruthy());
    await next();
    await shows(() => expect(stepDialog(/Four Ways to Combine/)).toBeTruthy());
    await next();
    await shows(() => expect(stepDialog(/One Shape/)).toBeTruthy());
    await next();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'LogoTourCompleted');
    // What the demonstration placed goes with the tour.
    expect(clear).toHaveBeenCalled();
  });

  it('ends with its page, sending no Ended event', async () => {
    const { rerender } = render(<Page of={page('logo')} />);
    await showMe();
    await next(); // Guides
    await shows(() => expect(stepDialog(/Draw on Guides/)).toBeTruthy());
    rerender(<Page of={page('logo')} deleted />);
    await settle();
    expect(screen.queryByRole('dialog', { name: /^Show Me step/ })).toBeNull();
    expect(track).not.toHaveBeenCalledWith('UI', 'Ended', expect.anything());
  });
});
