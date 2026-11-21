// @vitest-environment jsdom

// A page's cover in the editor (docs/specs/030-knowledgebase/page-surface.md "The cover"): the band, its controls
// for an Editor alone, reposition, remove with Undo, and the cover menu from Add Cover.
import { Profiler } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_KNOWLEDGE_STYLE, type Tab } from '@liveknowledge/document';
import { knowledgeStyleStore } from '@/lib/knowledge-style/knowledge-style-store';
import { chromeValue, renderInEditor, type Role } from '@/components/ask/test-chrome';
import type { EditorChromeStore } from '@/app/document/[id]/EditorContext';
import { PageCoverBand } from './PageCoverBand';
import { AddCoverButton } from './AddCoverButton';
import {
  coverEditable,
  coverOfTab,
  coverThemeOf,
  usePageHasCover,
  withTabCover,
} from './page-cover-state';

// The meta row's way: Add Cover while the page has none.
function MetaAndBand() {
  const has = usePageHasCover();
  return (
    <>
      {has ? null : <AddCoverButton />}
      <PageCoverBand />
    </>
  );
}
import { animatedCoverOf } from './CoverMenu';
import { draggedCoverFocus } from './useCoverReposition';

const toast = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
// The picker is its own component's to test (ImagePicker.test.tsx): here it says it opened, and picks on a press.
vi.mock('@/components/panels/ImagePicker', () => ({
  ImagePicker: ({ onSelect }: { onSelect: (i: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSelect({ id: 'img_new', width: 10, height: 10, credit: { text: 'By A', sourceUrl: 'x' } })
      }
    >
      The Picker
    </button>
  ),
}));

beforeAll(() => {
  // A desktop window: the cover menu is a popover there.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
});

beforeEach(() => {
  toast.info.mockClear();
  track.mockClear();
  knowledgeStyleStore.clear();
});

const PICTURE = { imageId: 'data:image/png;base64,AAAA', credit: 'Photo by A' };

/** The editor's store over one page, its commits applied to the store as the editor's are. */
function mount(ui: React.ReactElement, cover: unknown, role: Role = 'edit', over = {}) {
  const tab = {
    id: 'p1',
    name: 'Release Process',
    elements: [],
    ...(cover ? { cover } : {}),
  } as Tab;
  const ref: { store?: EditorChromeStore } = {};
  const value = chromeValue(role, {
    tabs: [tab],
    activeTab: tab,
    isReadOnly: role === 'view',
    participating: role === 'participate',
    workbenchMode: false,
    commitTabs: (map: (ts: Tab[]) => Tab[]) => {
      const s = ref.store!.get();
      const tabs = map(s.tabs);
      ref.store!.set({ ...s, tabs, activeTab: tabs[0]! });
    },
    ...over,
  });
  const out = renderInEditor(ui, value);
  ref.store = out.store;
  return { ...out, cover: () => coverOfTab(out.store.get().activeTab) };
}

describe('who may change a cover', () => {
  it('is an Editor, in edit mode where the page has one', () => {
    expect(coverEditable({ isReadOnly: false, participating: false })).toBe(true);
    expect(coverEditable({ isReadOnly: true, participating: false })).toBe(false);
    expect(coverEditable({ isReadOnly: false, participating: true })).toBe(false);
    expect(
      coverEditable({ isReadOnly: false, participating: false, pageEditing: { editing: false } }),
    ).toBe(false);
    expect(
      coverEditable({ isReadOnly: false, participating: false, pageEditing: { editing: true } }),
    ).toBe(true);
  });

  it.each<Role>(['participate', 'view'])(
    'shows a %s the cover and none of its controls',
    (role) => {
      const { container } = mount(<PageCoverBand />, PICTURE, role);
      expect(container.querySelector('[data-page-cover="picture"]')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Change Cover/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Remove Cover' })).toBeNull();
    },
  );

  it('shows an Editor reading a page with edit mode none of them either', () => {
    mount(<PageCoverBand />, PICTURE, 'edit', { pageEditing: { editing: false } });
    expect(screen.queryByRole('button', { name: /Change Cover/ })).toBeNull();
  });
});

describe('the band', () => {
  it('draws nothing for a page with no cover, or one it cannot read', () => {
    expect(mount(<PageCoverBand />, undefined).container.innerHTML).toBe('');
    expect(mount(<PageCoverBand />, { imageId: 'javascript:x' }).container.innerHTML).toBe('');
  });

  it('paints a gradient, and a picture over the accent tint, fading in once it lands, with its credit', () => {
    const gradient = mount(<PageCoverBand />, { gradient: 'theme-bright' });
    const band = gradient.container.querySelector<HTMLElement>('[data-page-cover="gradient"]')!;
    expect(band.style.background).toContain('linear-gradient');
    expect(band.style.height).toBe('var(--page-cover-height, 0px)');
    gradient.unmount();

    const { container } = mount(<PageCoverBand />, { ...PICTURE, focus: 20 });
    const picture = container.querySelector<HTMLElement>('[data-page-cover="picture"]')!;
    expect(picture.className).toContain('bg-brand-50');
    const img = picture.querySelector('img')!;
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.style.objectPosition).toBe('50% 20%');
    expect(img.className).toContain('opacity-0');
    fireEvent.load(img);
    expect(img.className).toContain('opacity-100');
    expect(screen.getByText('Photo by A')).toBeTruthy();
  });
});

describe('a cover in the knowledgebase’s style', () => {
  it('recolours an existing gradient cover when the Knowledgebase Style changes', () => {
    const { container } = mount(<PageCoverBand />, { gradient: 'theme-bright' });
    const band = () => container.querySelector<HTMLElement>('[data-page-cover="gradient"]')!;
    const lime = band().style.background;
    act(() => {
      knowledgeStyleStore.set('d1', { ...DEFAULT_KNOWLEDGE_STYLE, theme: 'ocean' });
    });
    const ocean = band().style.background;
    expect(ocean).toContain('linear-gradient');
    expect(ocean).not.toBe(lime);
    // A picked accent recolours it too.
    act(() => {
      knowledgeStyleStore.set('d1', {
        ...DEFAULT_KNOWLEDGE_STYLE,
        theme: 'ocean',
        accent: '#be123c',
      });
    });
    expect(band().style.background).not.toBe(ocean);
  });

  it('moves an animated cover over its gradient, its parts in the theme', () => {
    const { container } = mount(<PageCoverBand />, {
      motion: 'aurora',
      colouring: 'deep',
      speed: 2,
    });
    const band = container.querySelector<HTMLElement>('[data-page-cover="animated"]')!;
    expect(band.style.background).toContain('linear-gradient');
    const layer = band.querySelector<HTMLElement>(
      '[data-cover-motion] [data-page-motion="aurora"]',
    )!;
    expect(layer).toBeTruthy();
    expect(layer.style.getPropertyValue('--pm-rate')).toBe('2');
    // No Reposition on a moving cover; Change Cover and Remove Cover stand.
    expect(screen.queryByRole('button', { name: /Reposition/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Change Cover/ })).toBeTruthy();
  });

  it('pauses while the browser tab is hidden', () => {
    const { container } = mount(<PageCoverBand />, { motion: 'waves', colouring: 'soft' });
    const box = container.querySelector<HTMLElement>('[data-cover-motion]')!;
    expect(box.hasAttribute('data-cover-paused')).toBe(false);
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(box.hasAttribute('data-cover-paused')).toBe(true);
    hidden.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(box.hasAttribute('data-cover-paused')).toBe(false);
    hidden.mockRestore();
  });

  it('stores an animated choice by its theme colouring, never colours of its own', () => {
    const theme = coverThemeOf(DEFAULT_KNOWLEDGE_STYLE);
    expect(
      animatedCoverOf(
        { kind: 'gradient', from: '#000000', to: '#ffffff', angle: 160, motion: 'aurora' },
        theme,
      ),
    ).toBeUndefined();
    expect(animatedCoverOf({ kind: 'solid', color: '#ffffff' }, theme)).toBeUndefined();
  });
});

describe('the band’s cost', () => {
  it('renders the band no more for a change that is not its cover', () => {
    let renders = 0;
    const page = mount(
      <Profiler id="band" onRender={() => (renders += 1)}>
        <PageCoverBand />
      </Profiler>,
      PICTURE,
    );
    const before = renders;
    // A typing commit: the writing and the elements move, the cover is the same stored value.
    for (let i = 0; i < 20; i++)
      act(() => {
        const s = page.store.get();
        const tab = { ...s.activeTab, elements: [], name: `Release ${i}` };
        page.store.set({ ...s, tabs: [tab], activeTab: tab });
      });
    expect(renders).toBe(before);
  });
});

describe('an Editor’s cover controls', () => {
  it('removes the cover at once, with an Undo that puts it back', () => {
    const page = mount(<PageCoverBand />, PICTURE);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Cover' }));
    expect(page.cover()).toBeUndefined();
    expect(track).toHaveBeenCalledWith('Element', 'Deleted', 'Cover');
    const [message, options] = toast.info.mock.calls[0]!;
    expect(message).toBe('Cover removed');
    act(() => (options as { action: { onSelect: () => void } }).action.onSelect());
    expect(page.cover()).toEqual(PICTURE);
  });

  it('offers Reposition on a picture alone', () => {
    mount(<PageCoverBand />, { gradient: 'theme-ink' });
    expect(screen.getByRole('button', { name: /Change Cover/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Reposition/ })).toBeNull();
  });

  it('repositions by the keys, storing nothing until Save Position', () => {
    const page = mount(<PageCoverBand />, PICTURE);
    fireEvent.click(screen.getByRole('button', { name: /Reposition/ }));
    const slider = screen.getByRole('slider', { name: 'Cover Position' });
    expect(screen.getByText('Drag the picture to reposition')).toBeTruthy();
    expect(document.activeElement).toBe(slider);
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(slider.getAttribute('aria-valuenow')).toBe('55');
    expect(page.cover()).toEqual(PICTURE);
    fireEvent.keyDown(slider, { key: 'Escape' });
    expect(screen.queryByRole('slider')).toBeNull();
    expect(page.cover()).toEqual(PICTURE);

    fireEvent.click(screen.getByRole('button', { name: /Reposition/ }));
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('button', { name: 'Save Position' }));
    expect(page.cover()).toEqual({ ...PICTURE, focus: 45 });
    // Enter saves too; a position back at the middle is not kept.
    fireEvent.click(screen.getByRole('button', { name: /Reposition/ }));
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowUp' });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'Enter' });
    expect(page.cover()).toEqual(PICTURE);
  });

  it('moves a picture with the drag by the part of it the band hides', () => {
    // A 1000 x 1000 picture in a 1000 x 220 band hides 780 px: dragging it down 78 px shows 10% more of its top.
    const picture = { width: 1000, height: 1000 };
    const band = { width: 1000, height: 220 };
    expect(draggedCoverFocus(50, 78, picture, band)).toBe(40);
    expect(draggedCoverFocus(50, -78, picture, band)).toBe(60);
    expect(draggedCoverFocus(50, 5000, picture, band)).toBe(0);
    // A picture as wide as the band's shape has nothing to move; nor one not loaded yet.
    expect(draggedCoverFocus(50, 78, { width: 1000, height: 220 }, band)).toBe(50);
    expect(draggedCoverFocus(30, 78, { width: 0, height: 0 }, band)).toBe(30);
  });
});

describe('the cover menu', () => {
  it('sets a theme gradient from Add Cover, by its role, saying so in telemetry', () => {
    const page = mount(<AddCoverButton />, undefined);
    fireEvent.click(screen.getByRole('button', { name: /Add Cover/ }));
    expect(screen.getByRole('dialog', { name: 'Add Cover' })).toBeTruthy();
    const swatches = screen.getAllByRole('button', { pressed: false });
    expect(swatches).toHaveLength(14);
    fireEvent.click(screen.getByRole('button', { name: 'Theme Dusk' }));
    expect(page.cover()).toEqual({ gradient: 'theme-dusk' });
    expect(track).toHaveBeenCalledWith('Element', 'Added', 'Cover');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sets a picture, with its credit, through the picker', () => {
    const page = mount(<AddCoverButton />, undefined);
    fireEvent.click(screen.getByRole('button', { name: /Add Cover/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose a Picture' }));
    expect(screen.queryByRole('dialog', { name: 'Add Cover' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'The Picker' }));
    expect(page.cover()).toEqual({ imageId: 'img_new', credit: 'By A' });
  });

  it('marks the current gradient from Change Cover', () => {
    mount(<PageCoverBand />, { gradient: 'theme-ink' });
    fireEvent.click(screen.getByRole('button', { name: /Change Cover/ }));
    expect(screen.getByRole('button', { name: 'Theme Ink' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('sets an animated cover in the theme’s colourings, then changes its colouring, without custom colours', () => {
    const page = mount(<MetaAndBand />, undefined);
    fireEvent.click(screen.getByRole('button', { name: /Add Cover/ }));
    expect(screen.queryByRole('radio', { name: 'Custom Colours' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Aurora' }));
    expect(page.cover()).toEqual({ motion: 'aurora', colouring: 'deep' });
    // Add Cover has gone with the page's new cover; the menu carries on from the band's Change Cover.
    expect(screen.queryByRole('button', { name: /Add Cover/ })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Change Cover' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Theme Soft' }));
    expect(page.cover()).toEqual({ motion: 'aurora', colouring: 'soft' });
    expect(screen.queryByRole('radio', { name: 'Custom Colours' })).toBeNull();
  });
});

describe('a tab’s cover', () => {
  it('is put on and taken off, the same tab when there is none to take', () => {
    const tab = { id: 't', name: 'P', elements: [] } as Tab;
    expect(withTabCover(tab, undefined)).toBe(tab);
    const covered = withTabCover(tab, { imageId: 'img_a' });
    expect(covered.cover).toEqual({ imageId: 'img_a' });
    expect('cover' in withTabCover(covered, undefined)).toBe(false);
  });
});
