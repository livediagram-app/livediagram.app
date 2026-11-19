// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { configureWorkbench, resetWorkbenchForTests } from '../../bindings';
import { testBindings } from '../../lib/testing/bindings';
import { CategoryBarButtons, HOVER_CLOSE_MS, HOVER_OPEN_MS, useCategoryBar } from './CategoryBar';
import { CategoryBarFlyout } from './CategoryBarFlyout';
import type { FlyoutKit } from './category-flyout-kit';
import {
  CATEGORIES,
  testKit,
  type TestActions,
  type TestPending,
  type TestTile,
} from './category-flyout-test-kit';

// The flyout under the category bar and the side panel beside it (each editor's docs/specs/007-editor/toolbar-layout.md
// "The flyout" and "A tile's side panel"), every editor's one copy: its tiles, its keyboard and its hover intent. The
// editors' own tests drive it with their real tiles; these hold its every branch with a stand-in kit.

type Cat = (typeof CATEGORIES)[number];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  configureWorkbench(testBindings({ track: vi.fn() }));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  resetWorkbenchForTests();
});

function Strip({
  kit,
  actions,
  pendingDraw = null,
  isMobile = false,
  sideExtra,
  pressSide,
  palette = true,
}: {
  kit: FlyoutKit<TestTile, TestActions, TestPending>;
  actions: TestActions;
  pendingDraw?: TestPending;
  isMobile?: boolean;
  sideExtra?: (def: TestTile) => { tagline: string; body: React.ReactNode } | null;
  pressSide?: (def: TestTile) => boolean;
  palette?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const bar = useCategoryBar<Cat>(root, { widthOf: () => 416 });
  return (
    <div ref={root} {...(palette ? { 'data-toolbar-palette': '' } : {})}>
      <CategoryBarButtons bar={bar} categories={CATEGORIES} labels divider={<hr />} />
      <CategoryBarFlyout
        bar={bar}
        categories={CATEGORIES}
        kit={kit}
        actions={actions}
        pendingDraw={pendingDraw}
        isMobile={isMobile}
        scale={1}
        sideExtra={sideExtra}
        pressSide={pressSide}
      />
    </div>
  );
}

function show(props: Partial<Parameters<typeof Strip>[0]> = {}) {
  const actions: TestActions = { hasImage: false, used: [] };
  const kit = props.kit ?? testKit();
  render(<Strip kit={kit} actions={actions} {...props} />);
  return { actions, kit };
}

const button = (name: string) => screen.getByRole('button', { name });
const flyout = () => document.querySelector<HTMLElement>('[data-category-flyout]');
const side = () => document.querySelector<HTMLElement>('[data-category-flyout-side]');
const tileIn = (el: HTMLElement | null, name: string) => within(el!).getByRole('button', { name });
const footer = (el: HTMLElement | null) => el!.querySelector('[data-flyout-footer]')!.textContent;
const open = (name: string) => fireEvent.click(button(name), { detail: 1 });
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('the flyout', () => {
  it('draws nothing until a category opens', () => {
    show();
    expect(flyout()).toBeNull();
  });

  it('shows a grid category’s tiles in its named groups, under its header and count', () => {
    show();
    open('Shapes');
    const card = flyout()!;
    expect(card.querySelector('h3')!.textContent).toBe('Shapes');
    expect(card.textContent).toContain('The basics.');
    // The photo tile needs a picture, so four of five show.
    expect(card.querySelector('header')!.textContent).toContain('4');
    // A tile with a side panel says so with a chevron.
    expect(tileIn(card, 'Lasso').querySelector('svg:not([data-icon])')).not.toBeNull();
    expect([...card.querySelectorAll('h4')].map((h) => h.textContent)).toEqual(['Basics', 'More']);
    expect(within(card).getByRole('region', { name: 'Basics' })).toBeTruthy();
    expect(card.querySelector('ul')!.style.gridTemplateColumns).toBe('repeat(4, minmax(0px, 1fr))');
    expect(tileIn(card, 'Square').textContent).toContain('R');
    expect(within(card).queryByRole('button', { name: 'Photo' })).toBeNull();
  });

  it('shows the tiles a picture brings once there is one', () => {
    const actions: TestActions = { hasImage: true, used: [] };
    render(<Strip kit={testKit()} actions={actions} />);
    open('Shapes');
    expect(tileIn(flyout(), 'Photo')).toBeTruthy();
  });

  it('shows a card category as cards, its lead first, untitled', () => {
    show();
    open('Build');
    const card = flyout()!;
    expect(card.textContent).toContain('Your own blocks');
    expect(card.querySelector('h4')).toBeNull();
    expect(within(card).getByRole('region', { name: 'Build' })).toBeTruthy();
    expect(card.querySelector('ul')!.className).toContain('grid-cols-2');
    expect(tileIn(card, 'Card').textContent).toContain('2 presets');
    expect(tileIn(card, 'Devices').textContent).toContain('2 devices');
    expect(tileIn(card, 'Aws').textContent).toContain('Amazon’s marks.');
    // A description that names a click says it each pointer's way.
    expect(tileIn(card, 'Note').textContent).toContain('Double-click to edit it.');
    expect(tileIn(card, 'Locked').className).toContain('cursor-not-allowed');
  });

  it('lays a short card category out in one column', () => {
    show();
    open('Media');
    expect(flyout()!.querySelector('ul')!.className).toContain('grid-cols-1');
  });

  it('shows a catalogue’s own browse, with no footer', () => {
    show();
    open('Icons');
    expect(screen.getByTestId('catalogue').textContent).toBe('Browse every icon');
    expect(flyout()!.querySelector('[data-flyout-footer]')).toBeNull();
  });

  it('says what the pointed-at tile does in its footer, or the hint', () => {
    show();
    open('Build');
    expect(footer(flyout())).toContain('Click to add one, or drag it onto the canvas.');
    fireEvent.pointerEnter(tileIn(flyout(), 'Card'));
    expect(footer(flyout())).toContain('Choose a preset to start from.');
    fireEvent.pointerEnter(tileIn(flyout(), 'Devices'));
    expect(footer(flyout())).toContain('Choose one of the 2 devices.');
    fireEvent.pointerEnter(tileIn(flyout(), 'Aws'));
    expect(footer(flyout())).toContain('Browse Aws.');
    fireEvent.focus(tileIn(flyout(), 'Note'));
    expect(footer(flyout())).toContain('Adds a note.');
    expect(footer(flyout())).toContain('PressN');
  });

  it('describes a tile by its description where the kit has no line of its own', () => {
    show({ kit: testKit({ footerLine: undefined }) });
    open('Build');
    fireEvent.pointerEnter(tileIn(flyout(), 'Aws'));
    expect(footer(flyout())).toContain('Adds a aws.');
  });
});

describe('a tile', () => {
  it('places at a press, and drags with the canvas preview cleared at the end', () => {
    const { actions, kit } = show();
    open('Shapes');
    const square = tileIn(flyout(), 'Square');
    expect(square.getAttribute('draggable')).toBe('true');
    // A tile without a drag is not draggable.
    expect(tileIn(flyout(), 'Star').getAttribute('draggable')).toBeNull();
    fireEvent.click(square);
    expect(actions.used).toEqual(['square']);
    // The drop closes the flyout, as any drag out of it does.
    fireEvent.dragEnd(square);
    expect(kit.dragEnd).toHaveBeenCalled();
  });

  it('is refused, saying why, when disabled', () => {
    const { actions } = show();
    open('Shapes');
    const circle = tileIn(flyout(), 'Circle');
    expect(circle.getAttribute('aria-disabled')).toBe('true');
    expect(circle.getAttribute('title')).toBe('Not here');
    expect(circle.textContent).not.toContain('O');
    fireEvent.click(circle);
    expect(actions.used).toEqual([]);
  });

  it('shows the armed tool pressed, in the brand look rather than the tint', () => {
    show({ pendingDraw: 'square' });
    open('Shapes');
    const square = tileIn(flyout(), 'Square');
    expect(square.getAttribute('aria-pressed')).toBe('true');
    expect(square.querySelector('span')!.getAttribute('style')).toBeNull();
    expect(tileIn(flyout(), 'Star').querySelector('span')!.className).toContain('tinted');
  });
});

describe('a tile’s side panel', () => {
  it('opens beside the flyout at a press, a second press closes it', () => {
    show();
    open('Build');
    const card = tileIn(flyout(), 'Card');
    expect(card.getAttribute('draggable')).toBeNull();
    expect(card.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(card);
    expect(card.getAttribute('aria-expanded')).toBe('true');
    expect(side()!.getAttribute('aria-label')).toBe('Card');
    expect(side()!.textContent).toContain('Start from a preset, then change any of it.');
    // A preset needs a picture, so one of two shows.
    expect(within(side()!).getAllByRole('button')).toHaveLength(1);
    fireEvent.click(card);
    expect(side()).toBeNull();
  });

  it('places a preset at a press and describes it in its own footer', () => {
    const { actions } = show();
    open('Build');
    fireEvent.click(tileIn(flyout(), 'Devices'));
    expect(side()!.textContent).toContain('Frames to set a screen design in.');
    expect(footer(side())).toContain('Click to add one');
    fireEvent.pointerEnter(tileIn(side(), 'Phone'));
    expect(footer(side())).toContain('Phone');
    fireEvent.click(tileIn(side(), 'Phone'));
    expect(actions.used).toEqual(['phone']);
  });

  it('opens on a rest, and a rest on another tile closes it', () => {
    show();
    open('Build');
    fireEvent.pointerEnter(tileIn(flyout(), 'Card'));
    wait(149);
    expect(side()).toBeNull();
    wait(1);
    expect(side()).not.toBeNull();
    // Resting on the open one again changes nothing.
    fireEvent.pointerEnter(tileIn(flyout(), 'Card'));
    wait(HOVER_CLOSE_MS);
    expect(side()).not.toBeNull();
    // Reaching the panel keeps it, though the pointer left the tile for another on the way.
    fireEvent.pointerEnter(tileIn(flyout(), 'Note'));
    fireEvent.pointerEnter(side()!, { pointerType: 'mouse' });
    wait(HOVER_CLOSE_MS);
    expect(side()).not.toBeNull();
    fireEvent.pointerEnter(tileIn(flyout(), 'Note'));
    wait(HOVER_CLOSE_MS);
    expect(side()).toBeNull();
    // A rest on a plain tile with nothing open schedules nothing.
    fireEvent.pointerEnter(tileIn(flyout(), 'Note'));
    wait(HOVER_CLOSE_MS);
    expect(side()).toBeNull();
  });

  it('holds what the editor puts there for a tile without presets', () => {
    show({
      sideExtra: (def) =>
        def.kind === 'side' ? { tagline: `Browse ${def.label}.`, body: <p>Every mark</p> } : null,
    });
    open('Build');
    fireEvent.click(tileIn(flyout(), 'Aws'));
    expect(side()!.textContent).toContain('Browse Aws.');
    expect(side()!.textContent).toContain('Every mark');
    expect(side()!.querySelector('[data-flyout-footer]')).toBeNull();
    // A tile the editor gives nothing shows only its header.
    fireEvent.click(tileIn(flyout(), 'Fill'));
    expect(side()!.querySelector('h3')!.textContent).toBe('Fill');
    expect(side()!.querySelector('p')!.textContent).toBe('');
  });

  it('shows only its header without an editor’s extra', () => {
    show();
    open('Build');
    fireEvent.click(tileIn(flyout(), 'Aws'));
    expect(side()!.querySelector('p')!.textContent).toBe('');
  });

  it('lets the editor take a press itself', () => {
    const { actions } = show({
      pressSide: (def) => {
        if (def.kind !== 'tool') return false;
        actions.used.push('picked-up');
        return true;
      },
    });
    open('Build');
    fireEvent.click(tileIn(flyout(), 'Fill'));
    expect(side()).toBeNull();
    fireEvent.click(tileIn(flyout(), 'Card'));
    expect(side()).not.toBeNull();
  });

  it('drops the panel when the flyout moves to another category', () => {
    show();
    open('Build');
    fireEvent.click(tileIn(flyout(), 'Card'));
    open('Shapes');
    expect(side()).toBeNull();
  });

  it('opens nowhere outside the strip’s root', () => {
    show({ palette: false });
    open('Build');
    fireEvent.click(tileIn(flyout(), 'Card'));
    expect(side()).toBeNull();
  });

  it('lies over the flyout on a phone', () => {
    show({ isMobile: true });
    open('Build');
    fireEvent.click(tileIn(flyout(), 'Card'));
    expect(side()!.className).toContain('inset-x-3');
    expect(side()!.style.right).toBe('');
  });

  it('fades while a tile is dragged out', () => {
    show();
    open('Build');
    fireEvent.click(tileIn(flyout(), 'Card'));
    fireEvent.dragStart(side()!);
    expect(side()!.hasAttribute('data-drop-through')).toBe(true);
    expect(side()!.className).toContain('opacity-30');
    // It closes on the drop, with the flyout.
    fireEvent.dragEnd(side()!);
    expect(side()).toBeNull();
  });
});

describe('the keyboard', () => {
  it('focuses the first tile when opened from the keyboard, and walks the tiles', () => {
    show();
    fireEvent.keyDown(button('Shapes'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tileIn(flyout(), 'Square'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tileIn(flyout(), 'Circle'));
  });

  it('enters a side panel with ArrowRight, and ArrowLeft or Escape hand the focus back', () => {
    show();
    open('Build');
    const card = tileIn(flyout(), 'Card');
    card.focus();
    fireEvent.keyDown(card, { key: 'ArrowRight' });
    const preset = tileIn(side(), 'Plain-card');
    expect(document.activeElement).toBe(preset);
    fireEvent.keyDown(preset, { key: 'ArrowLeft' });
    expect(side()).toBeNull();
    expect(document.activeElement).toBe(card);
    // Into a panel a rest already opened: the focus moves in.
    fireEvent.pointerEnter(card);
    wait(150);
    expect(document.activeElement).toBe(card);
    fireEvent.keyDown(card, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tileIn(side(), 'Plain-card'));
    // Escape steps out of the panel only.
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(side()).toBeNull();
    expect(flyout()).not.toBeNull();
    expect(document.activeElement).toBe(card);
  });

  it('walks a panel’s presets with the arrows, ArrowLeft in a field keeping the caret', () => {
    show({
      sideExtra: () => ({ tagline: 'Search', body: <input aria-label="Find" /> }),
    });
    open('Build');
    const aws = tileIn(flyout(), 'Aws');
    fireEvent.keyDown(aws, { key: 'ArrowRight' });
    const field = screen.getByRole('textbox', { name: 'Find' });
    expect(document.activeElement).toBe(field);
    fireEvent.keyDown(field, { key: 'ArrowLeft' });
    expect(side()).not.toBeNull();
    // Escape away from the panel leaves it to the flyout.
    aws.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(side()).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(side()).not.toBeNull();
  });

  it('closes the flyout on Escape, handing the focus back to its button', () => {
    show();
    fireEvent.keyDown(button('Shapes'), { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(flyout()).not.toBeNull();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(flyout()).toBeNull();
    expect(document.activeElement).toBe(button('Shapes'));
  });
});

describe('hover intent across the flyout', () => {
  it('keeps a hover-opened flyout while the mouse is over it, and closes once it leaves', () => {
    show();
    fireEvent.pointerEnter(button('Shapes'), { pointerType: 'mouse' });
    wait(HOVER_OPEN_MS);
    expect(flyout()).not.toBeNull();
    fireEvent.pointerLeave(button('Shapes'), { pointerType: 'mouse' });
    const body = flyout()!.firstElementChild!;
    fireEvent.pointerEnter(body, { pointerType: 'mouse' });
    wait(HOVER_CLOSE_MS);
    expect(flyout()).not.toBeNull();
    // A touch passing over is not a mouse leaving.
    fireEvent.pointerLeave(body, { pointerType: 'touch' });
    fireEvent.pointerEnter(body, { pointerType: 'touch' });
    wait(HOVER_CLOSE_MS);
    expect(flyout()).not.toBeNull();
    fireEvent.pointerLeave(body, { pointerType: 'mouse' });
    wait(HOVER_CLOSE_MS);
    expect(flyout()).toBeNull();
  });
});
