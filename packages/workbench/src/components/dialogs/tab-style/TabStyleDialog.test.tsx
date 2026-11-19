// @vitest-environment jsdom
// The shared Tab Style dialog over a fake profile (liveworkspace/docs/specs/011-workbench/tab-style.md): what the
// profile's surfaces decide, the two frames, the looks carousel and the panels. Each editor's CanvasThemeDialog.test
// drives it over the real profile.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORKBENCH_DEFAULTS, configureWorkbench } from '../../../bindings';
import { createTabStyleTour } from '../../tour/TabStyleTour';
import { acrossPages } from '../../primitives/paged-carousel-testing';
import { TabStyleDialog } from './TabStyleDialog';
import {
  TAB_STYLE_COPY,
  TAB_STYLE_PANELS,
  type TabStyleCanvasPanelProps,
  type TabStyleFrameParts,
  type TabStyleLook,
  type TabStyleProfile,
} from './tab-style-profile';

// jsdom has no ResizeObserver; the animated height measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const track = vi.fn();
beforeEach(() => configureWorkbench({ ...WORKBENCH_DEFAULTS, track }));
afterEach(() => {
  track.mockClear();
  cleanup();
  document.body.innerHTML = '';
});

const look = (id: string, finish: TabStyleLook['finish'], season?: TabStyleLook['season']) => ({
  id,
  label: id[0]!.toUpperCase() + id.slice(1),
  description: `${id} look`,
  theme: id,
  finish,
  font: undefined,
  pattern: 'grid',
  season,
});
const LOOKS = [look('everyday', 'flexible'), look('sketchy', 'sketch'), look('crisp', 'professional')];
const SEASONAL = [look('haunted', 'sketch', 'halloween'), look('frosty', 'flexible', 'christmas')];
const ALL = [...LOOKS, ...SEASONAL];
const matches = (s: { theme?: string; finish?: unknown }, l: TabStyleLook) =>
  s.theme === l.theme && (s.finish ?? 'flexible') === l.finish;

// The mashup rolls through these, in turn.
let rolls = 0;
const rollMashup = vi.fn((options?: { finish?: TabStyleLook['finish'] }) => {
  rolls++;
  return { ...look(`mix${rolls}`, options?.finish ?? 'marker'), label: 'Mashup' };
});

const tour = createTabStyleTour({
  ShowMeButton: ({ tour: engine, onStart }) => (
    <button
      type="button"
      onClick={() => {
        onStart();
        engine.start();
      }}
    >
      Show Me
    </button>
  ),
  ShowMeStage: () => null,
  track,
});

const canvasPanel = vi.fn((p: TabStyleCanvasPanelProps<string>) => (
  <div data-testid="canvas-panel">
    {[...p.hidden].join(',')}
    <button type="button" onClick={() => p.onSetBackgroundAnimationSpeed(2)}>
      Speed
    </button>
    <button type="button" onClick={() => p.onSetBackgroundPattern('dots')}>
      Dots
    </button>
  </div>
));

function profileWith(
  over: Partial<TabStyleProfile<TabStyleLook, string>> = {},
): TabStyleProfile<TabStyleLook, string> {
  return {
    looks: {
      all: LOOKS,
      seasonalFor: () => SEASONAL,
      matches,
      activeId: (s) => ALL.find((l) => matches(s, l))?.id,
      preview: (l) => ({ markup: `<svg data-look="${l.id}"></svg>`, paper: '#fff' }),
      rollMashup,
    },
    themeSummary: (id) => ({ label: `Theme ${id}`, swatch: <i>swatch</i> }),
    ThemeBrowser: ({ onSelect, onCommit }) => (
      <div>
        <button type="button" onClick={() => onSelect('ocean')}>
          Ocean
        </button>
        <button type="button" onClick={() => onCommit('forest')}>
          Forest
        </button>
      </div>
    ),
    finishLabels: { flexible: 'Flexible', professional: 'Professional', sketch: 'Sketch', marker: 'Marker' },
    FinishSwatch: ({ finish }) => <b>{finish}</b>,
    patternLabel: (p) => `Pattern ${p}`,
    TextSizeControl: ({ current, onSet, onPreview, onPreviewEnd }) => (
      <div data-testid="size" data-current={String(current)}>
        <button type="button" onClick={() => onPreview(30)}>
          Preview 30
        </button>
        <button type="button" onClick={onPreviewEnd}>
          End
        </button>
        <button type="button" onClick={() => onSet('lg')}>
          Large
        </button>
      </div>
    ),
    useAppearance: () => 'light',
    renderHelp: (article) => <a href={`#${article}`}>Help</a>,
    frame: { kind: 'modal', tour },
    base: {
      panels: TAB_STYLE_PANELS,
      hiddenControls: [],
      renderCanvasPanel: canvasPanel,
      renderPreview: (kind, p) => (
        <div role="img" aria-label={`${kind}: ${p.finishLabel}, ${p.fontLabel}, ${String(p.textSize)}`} />
      ),
      copy: TAB_STYLE_COPY,
    },
    ...over,
  };
}

type Props = ComponentProps<typeof TabStyleDialog<TabStyleLook, string>>;
function props(over: Partial<Props> = {}): Props {
  return {
    profile: profileWith(),
    tab: 'looks',
    onTabChange: vi.fn(),
    backgroundPattern: 'grid',
    backgroundColor: '#ffffff',
    patternColor: '#cccccc',
    backgroundOpacity: 1,
    backgroundPatternScale: 1,
    onSetBackgroundPattern: vi.fn(),
    onSetBackgroundColor: vi.fn(),
    onSetPatternColor: vi.fn(),
    onSetBackgroundOpacity: vi.fn(),
    onSetBackgroundPatternScale: vi.fn(),
    themeId: 'everyday',
    onSetTheme: vi.fn(),
    font: null,
    onSetFont: vi.fn(),
    defaultTextSize: undefined,
    onSetDefaultTextSize: vi.fn(),
    finish: undefined,
    onSetFinish: vi.fn(),
    onApplyLook: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
}
const open = (over: Partial<Props> = {}) => {
  const p = props(over);
  return { p, ...render(<TabStyleDialog {...p} />) };
};
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const cardNames = () =>
  acrossPages(
    'Looks',
    () =>
      screen
        .getAllByRole('button')
        .filter((b) => b.hasAttribute('aria-pressed') && b.textContent !== 'Seasonal')
        .map((b) => b.querySelector('span > span.text-\\[13px\\]')?.textContent),
    fireEvent.click,
  );

describe('the home', () => {
  it('shows a Fine-tune row per panel with its value, each opening its panel', () => {
    const { p } = open({ defaultTextSize: 18 });
    expect(screen.getByText('Pick a look for the whole tab, then fine-tune any part of it.')).toBeTruthy();
    expect(button('Colours: Theme everyday theme')).toBeTruthy();
    expect(button('Finish: Flexible')).toBeTruthy();
    expect(button('Text: Editor default, 18px')).toBeTruthy();
    fireEvent.click(button('Canvas: Pattern grid'));
    expect(p.onTabChange).toHaveBeenCalledWith('canvas');
    expect(screen.getByRole('link', { name: 'Help' }).getAttribute('href')).toBe('#changingTheme');
  });

  it('names a preset size, medium when unset', () => {
    open({ defaultTextSize: 'sm' });
    expect(button('Text: Editor default, small')).toBeTruthy();
    cleanup();
    open();
    expect(button('Text: Editor default, medium')).toBeTruthy();
  });

  it("follows the surface: its panels, its names, and the size left out of the Text row's value", () => {
    const profile = profileWith({
      surfaces: {
        article: {
          panels: ['theme', 'font'],
          hiddenControls: ['defaultTextSize'],
          copy: { panelTitles: { font: 'Writing' } },
        },
      },
    });
    open({ profile, surface: 'article' });
    expect(screen.queryByRole('button', { name: /^Canvas:/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Finish:/ })).toBeNull();
    expect(button('Writing: Editor default')).toBeTruthy();
  });

  it('opens on the home when asked for a panel the surface leaves out', () => {
    const profile = profileWith({ surfaces: { article: { panels: ['theme'] } } });
    open({ profile, surface: 'article', tab: 'canvas' });
    expect(screen.queryByTestId('canvas-panel')).toBeNull();
    expect(document.querySelector('[data-tab-style-view="looks"]')).not.toBeNull();
  });

  it('offers Apply to All Tabs to an Editor of the whole item, naming locked tabs only where the app locks them', () => {
    const onApply = vi.fn();
    open({ allTabs: { tabCount: 3, applying: false, onApply } });
    fireEvent.click(button(/Apply to All Tabs/));
    expect(onApply).toHaveBeenCalled();
    expect(document.body.textContent).toMatch(/locked/i);
    cleanup();
    open({ profile: profileWith({ tabLocks: false }), allTabs: { tabCount: 3, applying: false, onApply } });
    expect(document.body.textContent).not.toMatch(/locked/i);
  });
});

describe('the looks', () => {
  it('shows the Mashup card and every look, the tab’s own selected, and applies a pick', () => {
    const { p } = open({ themeId: 'sketchy', finish: 'sketch' });
    expect(cardNames()).toEqual(['Mashup', 'Everyday', 'Sketchy', 'Crisp']);
    const sketchy = screen.getByRole('button', { name: /Sketchy/ });
    expect(sketchy.getAttribute('aria-pressed')).toBe('true');
    expect(sketchy.querySelector('[data-look="sketchy"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Crisp/ }));
    expect(p.onApplyLook).toHaveBeenCalledWith('crisp');
  });

  it("drops the looks the surface's filter leaves out", () => {
    const profile = profileWith({ base: { ...profileWith().base, lookFilter: (l) => l.id !== 'crisp' } });
    open({ profile });
    expect(cardNames()).toEqual(['Mashup', 'Everyday', 'Sketchy']);
  });

  it('narrows by finish, tracked, the mashup rolling within it', () => {
    open();
    const filter = screen.getByRole('combobox', { name: 'Filter looks by finish' });
    fireEvent.change(filter, { target: { value: 'sketch' } });
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'LooksFinishFilter');
    expect(cardNames()).toEqual(['Mashup', 'Sketchy']);
    expect(rollMashup).toHaveBeenLastCalledWith({ finish: 'sketch' });
    // Already within the finish, or every finish again: no new roll.
    const before = rollMashup.mock.calls.length;
    fireEvent.change(filter, { target: { value: 'sketch' } });
    fireEvent.change(filter, { target: { value: 'all' } });
    expect(rollMashup.mock.calls.length).toBe(before);
  });

  it('swaps in the seasonal looks, tracked, each under its season, with no Mashup card', () => {
    open();
    fireEvent.click(button('Seasonal'));
    expect(track).toHaveBeenCalledWith('UI', 'Changed', 'LooksSeasonal');
    expect(cardNames()).toEqual(['Haunted', 'Frosty']);
    expect(screen.getByText('Halloween')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Mashup/ })).toBeNull();
  });

  it('opens on the seasonal looks when the tab wears one', () => {
    open({ themeId: 'haunted', finish: 'sketch' });
    expect(button('Seasonal').getAttribute('aria-pressed')).toBe('true');
  });

  it('applies the mashup on show, then rolls another while the tab wears it', () => {
    const { p, rerender } = open();
    const mashup = () => screen.getByRole('button', { name: 'Mashup: a random look, press for another' });
    fireEvent.click(mashup());
    const shown = (p.onApplyLook as ReturnType<typeof vi.fn>).mock.calls[0]![0] as TabStyleLook;
    expect(shown.label).toBe('Mashup');
    // The tab now wears it.
    rerender(<TabStyleDialog {...p} themeId={shown.theme} finish={shown.finish} />);
    expect(mashup().getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(mashup());
    expect(rollMashup).toHaveBeenLastCalledWith({ finish: undefined, previous: shown });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter looks by finish' }), {
      target: { value: 'marker' },
    });
    rerender(<TabStyleDialog {...p} themeId={shown.theme} finish={shown.finish} />);
  });

  it('rolls within the chosen finish while the tab wears the mashup', () => {
    const { p, rerender } = open();
    const mashup = () => screen.getByRole('button', { name: 'Mashup: a random look, press for another' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter looks by finish' }), {
      target: { value: 'professional' },
    });
    fireEvent.click(mashup());
    const shown = (p.onApplyLook as ReturnType<typeof vi.fn>).mock.calls[0]![0] as TabStyleLook;
    rerender(<TabStyleDialog {...p} themeId={shown.theme} finish={shown.finish} />);
    fireEvent.click(mashup());
    expect(rollMashup).toHaveBeenLastCalledWith({ finish: 'professional', previous: shown });
  });
});

describe('the panels', () => {
  it('leads back home from a panel, under its line and help', () => {
    const { p } = open({ tab: 'finish' });
    expect(screen.getByText('How every element on the tab is drawn.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Help' }).getAttribute('href')).toBe('#choosingAFinish');
    fireEvent.click(screen.getByRole('button', { name: /Tab Style/ }));
    expect(p.onTabChange).toHaveBeenCalledWith('looks');
  });

  it('sets the finish from its tiles over the preview of the finish on show', () => {
    const { p } = open({ tab: 'finish', finish: 'sketch' });
    expect(screen.getByRole('radio', { name: /Sketch/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('img', { name: /^finish: Sketch, Editor default/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Marker/ }));
    expect(p.onSetFinish).toHaveBeenCalledWith('marker');
  });

  it("previews Flexible for a tab with no finish of its own", () => {
    open({ tab: 'finish' });
    expect(screen.getByRole('radio', { name: /Flexible/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('picks a typeface and the size of new text, the preview following the slider', () => {
    const { p } = open({ tab: 'font', font: 'inter' });
    expect(screen.getByRole('img', { name: /^text: Flexible, Inter, md$/ })).toBeTruthy();
    expect(button('Inter').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button('Editor default'));
    expect(p.onSetFont).toHaveBeenCalledWith(null);
    fireEvent.click(button('Preview 30'));
    expect(screen.getByRole('img', { name: /, 30$/ })).toBeTruthy();
    fireEvent.click(button('End'));
    expect(screen.getByRole('img', { name: /, md$/ })).toBeTruthy();
    fireEvent.click(button('Large'));
    expect(p.onSetDefaultTextSize).toHaveBeenCalledWith('lg');
  });

  it('offers only the faces the profile does, and no size where the surface hides it', () => {
    const profile = profileWith({
      fonts: [],
      base: { ...profileWith().base, hiddenControls: ['defaultTextSize'] },
    });
    open({ profile, tab: 'font' });
    expect(screen.queryByTestId('size')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Inter' })).toBeNull();
    expect(button('Editor default')).toBeTruthy();
  });

  it("hands the Canvas panel the tab's canvas, its hidden controls and an eased pattern setter", () => {
    const { p } = open({
      tab: 'canvas',
      profile: profileWith({
        base: { ...profileWith().base, hiddenControls: ['patternScale', 'patternColor'] },
      }),
    });
    expect(screen.getByTestId('canvas-panel').textContent).toContain('patternScale,patternColor');
    expect(canvasPanel.mock.lastCall![0].backgroundAnimationSpeed).toBe(1);
    // No speed setter from the editor (livehuddle's floors): a press does nothing.
    fireEvent.click(button('Speed'));
    fireEvent.click(button('Dots'));
    expect(p.onSetBackgroundPattern).toHaveBeenCalledWith('dots');
  });

  it("passes the editor's speed through when it has animated patterns", () => {
    const onSetBackgroundAnimationSpeed = vi.fn();
    open({ tab: 'canvas', backgroundAnimationSpeed: 1.5, onSetBackgroundAnimationSpeed });
    expect(canvasPanel.mock.lastCall![0].backgroundAnimationSpeed).toBe(1.5);
    fireEvent.click(button('Speed'));
    expect(onSetBackgroundAnimationSpeed).toHaveBeenCalledWith(2);
  });

  it('previews a theme live and commits it, closing the dialog', () => {
    const { p } = open({ tab: 'theme' });
    fireEvent.click(button('Ocean'));
    expect(p.onSetTheme).toHaveBeenCalledWith('ocean');
    fireEvent.click(button('Forest'));
    expect(p.onSetTheme).toHaveBeenCalledWith('forest');
    expect(p.onClose).toHaveBeenCalled();
  });
});

describe('the modal frame', () => {
  it('rises from the brush, and closes on Escape, an outside click and its close', () => {
    Object.assign(window, { innerWidth: 1440, innerHeight: 900 });
    const brush = document.createElement('button');
    brush.setAttribute('data-tour-id', 'canvas-theme');
    brush.getBoundingClientRect = () => ({ right: 1404, top: 840, width: 44 }) as DOMRect;
    document.body.appendChild(brush);
    const { p } = open();
    const panel = screen.getByRole('dialog', { name: 'Tab style' });
    expect(panel.style.bottom).toBe('68px');
    expect(panel.className).toContain('animate-fly-up-in');
    // A press inside, a right-click: neither closes it nor reaches the canvas.
    fireEvent.click(panel);
    fireEvent.pointerDown(panel.parentElement!);
    fireEvent.contextMenu(panel.parentElement!);
    expect(p.onClose).not.toHaveBeenCalled();
    fireEvent.click(panel.parentElement!);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(button('Close'));
    expect(p.onClose).toHaveBeenCalledTimes(3);
  });

  it("hangs below the profile's opener", () => {
    Object.assign(window, { innerWidth: 1440, innerHeight: 900 });
    const opener = document.createElement('button');
    opener.getBoundingClientRect = () => ({ right: 1000, bottom: 120, width: 40 }) as DOMRect;
    open({ profile: profileWith({ frame: { kind: 'modal', tour, opener: () => opener } }) });
    const panel = screen.getByRole('dialog', { name: 'Tab style' });
    expect(panel.style.top).toBe('128px');
    expect(panel.className).toContain('animate-dialog-in');
  });

  it('is the centred dialog with nothing to hang from', () => {
    Object.assign(window, { innerWidth: 1440, innerHeight: 900 });
    open();
    expect(screen.getByRole('dialog', { name: 'Tab style' }).style.right).toBe('');
  });

  it('runs Show Me, which brings the home forward and opens the Finish panel', async () => {
    const { p } = open({ tab: 'canvas' });
    fireEvent.click(button('Show Me'));
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'TabStyleTour');
    await act(async () => {});
    expect(p.onTabChange).toHaveBeenCalledWith('looks');
  });
});

describe('a frame of the product’s own', () => {
  it('wraps the views with the line, the help and the tour’s targets', () => {
    let parts: Omit<TabStyleFrameParts, 'children'> | undefined;
    const render_ = (frame: TabStyleFrameParts): ReactNode => {
      parts = frame;
      return <section aria-label="Own frame">{frame.children}</section>;
    };
    const { p } = open({
      tab: 'finish',
      finish: 'sketch',
      profile: profileWith({ frame: { kind: 'custom', render: render_ } }),
    });
    expect(screen.getByRole('region', { name: 'Own frame' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(parts!.view).toBe('finish');
    expect(parts!.subtitle).toBe('How every element on the tab is drawn.');
    expect(parts!.tourApi.finish()).toBe('sketch');
    parts!.tourApi.showFinish();
    expect(p.onTabChange).not.toHaveBeenCalled();
    parts!.tourApi.showHome();
    expect(p.onTabChange).toHaveBeenCalledWith('looks');
    parts!.tourApi.setFinish('marker');
    expect(p.onSetFinish).toHaveBeenCalledWith('marker');
    parts!.onClose();
    expect(p.onClose).toHaveBeenCalled();
  });

  it('opens the Finish panel from the home for the tour, and leaves the home as it is', () => {
    let parts: Omit<TabStyleFrameParts, 'children'> | undefined;
    const { p } = open({
      profile: profileWith({
        frame: {
          kind: 'custom',
          render: (frame) => {
            parts = frame;
            return frame.children;
          },
        },
      }),
    });
    parts!.tourApi.showHome();
    expect(p.onTabChange).not.toHaveBeenCalled();
    parts!.tourApi.showFinish();
    expect(p.onTabChange).toHaveBeenCalledWith('finish');
  });
});
