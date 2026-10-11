// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutIllustratePages, type IllustratePage } from '@livediagram/document';
import type { IllustratePageEdits } from '@/hooks/editor/useIllustratePages';
import { track } from '@/lib/telemetry';
import { IllustratePagePanel, type PagePanelTab } from '@/components/canvas/IllustratePagePanel';
import { logoTourSteps } from './logo-tour-steps';
import { LogoShowMeButton, LogoTourStage, useLogoTour } from './LogoTour';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// jsdom lays nothing out, so "on screen" is just "in the document" here.
vi.mock('./tour-dom', async (actual) => ({
  ...(await actual<typeof import('./tour-dom')>()),
  waitForSelector: async (selector: string) => document.querySelector<HTMLElement>(selector),
}));
afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
});

const LOGO: IllustratePage = { id: 'logo-1', orientation: 'portrait', kind: 'logo', size: 'logo' };
const INFOGRAPHIC: IllustratePage = { id: 'info-1', orientation: 'portrait', kind: 'infographic' };

const edits = (): IllustratePageEdits =>
  ({
    rename: vi.fn(),
    setBackground: vi.fn(),
    canDuplicate: () => true,
    canMove: () => false,
    applyLayout: vi.fn(),
    contentCount: () => 0,
    isLocked: () => false,
    removePage: vi.fn(),
  }) as unknown as IllustratePageEdits;

// IllustratePages' wiring, cut down: the page's panel, its title bar's Guides and Mirror, and the tour.
function Page({ page, combine = false }: { page: IllustratePage; combine?: boolean }) {
  const [opened, setOpened] = useState<{ tab: PagePanelTab; seq: number } | null>({
    tab: 'background',
    seq: 0,
  });
  const { tour, freeze } = useLogoTour({
    openLayouts: () => setOpened({ tab: 'layouts', seq: Date.now() }),
    closePanel: () => setOpened(null),
  });
  const laid = layOutIllustratePages([page])[0]!;
  return (
    <div>
      <div data-logo-title-bar={page.id}>
        <button type="button" aria-label="Mirror" />
        <button type="button" aria-label="Guides" />
      </div>
      {combine ? <button type="button" aria-label="Combine shapes" /> : null}
      {opened ? (
        <IllustratePagePanel
          key={opened.seq}
          page={laid}
          count={1}
          getAnchor={() => undefined}
          initialTab={opened.tab}
          themeBackgrounds={[]}
          edit={edits()}
          onPreview={vi.fn()}
          onLayoutPreview={vi.fn()}
          onClose={() => setOpened(null)}
          showMe={
            page.kind === 'logo' ? (
              <LogoShowMeButton tour={tour} onStart={() => freeze(page.id)} />
            ) : undefined
          }
        />
      ) : null}
      <LogoTourStage tour={tour} />
    </div>
  );
}

const settle = () => act(async () => new Promise((r) => setTimeout(r, 30)));
const next = async () => {
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  await settle();
};

// docs/specs/007-editor/logo-pages.md "Show Me".
describe('Logo page Show Me', () => {
  it('walks the layouts, the guides, mirror and combining, then a closing card', () => {
    expect(logoTourSteps(false).map((s) => s.id)).toEqual([
      'layouts',
      'guides',
      'mirror',
      'combine',
      'outro',
    ]);
    // Combine rings its button only while it is showing; otherwise it says where it appears.
    expect(logoTourSteps(true).find((s) => s.id === 'combine')?.selector).toBeDefined();
    const hidden = logoTourSteps(false).find((s) => s.id === 'combine')!;
    expect(hidden.selector ?? hidden.target).toBeUndefined();
  });

  it('heads a logo page’s panel beside Help, and no other page’s', () => {
    render(<Page page={INFOGRAPHIC} />);
    expect(screen.queryByRole('button', { name: 'Show Me' })).toBeNull();
    cleanup();
    render(<Page page={LOGO} />);
    expect(screen.getByRole('button', { name: 'Show Me' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /logo pages/i }).getAttribute('href')).toBe(
      '/help/canvas/illustrate/logo-pages/',
    );
  });

  it('reopens the panel on Layouts, then closes it for the title bar’s steps', async () => {
    render(<Page page={LOGO} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
    await settle();
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'LogoTour');
    expect(
      screen.getByRole('dialog', { name: /^Show Me step 1 of 4: Start From a Logo Layout/ }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Layouts' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    await next();
    expect(screen.queryByRole('textbox', { name: 'Page name' })).toBeNull();
    expect(screen.getByRole('dialog', { name: /Draw on Guides/ })).toBeTruthy();
    await next();
    expect(screen.getByRole('dialog', { name: /Mirror As You Draw/ })).toBeTruthy();
    await next();
    expect(screen.getByRole('dialog', { name: /Combine Shapes/ })).toBeTruthy();
    await next();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'LogoTourCompleted');
  });
});
