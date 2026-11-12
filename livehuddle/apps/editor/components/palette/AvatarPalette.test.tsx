// @vitest-environment jsdom
// The avatar palette (docs/specs/008-canvas/avatar-mode.md "The avatar palette"): the strip while walking, its look
// on the left and actions on the right, no call group (it is the Call dock's), no selection-mode picker, Say for whoever may speak, and
// its flyouts applying a choice at once.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_AVATAR_CONFIG,
  AVATAR_CLOTHING,
  AVATAR_HAIR,
  AVATAR_HAIR_COLOURS,
} from '@livehuddle/avatar/config';
import { bindAvatar } from '@/lib/avatar-bindings';
import { resetCallSelf, setCallActions, setCallSelf } from '@/lib/calls/calls-store';
import { AVATAR_PALETTE_CATEGORIES } from '@/lib/avatar-palette';
import { AVATAR_CALL_STATUSES, AVATAR_STATUS_GROUPS } from '@livehuddle/avatar/status';
import { AvatarPalette, type AvatarPaletteProps } from './AvatarPalette';
import { AvatarPaletteFlyout } from './AvatarPaletteFlyouts';
import { previewFits, type AvatarPaletteActions } from './avatar-palette-widths';
import { AvatarPalettePreview } from './AvatarPalettePreview';
import { getAvatarPreview, setAvatarPreview } from '@/lib/avatar-preview';

bindAvatar();

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => mobile.value,
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  cleanup();
  mobile.value = false;
  act(() => {
    setCallActions(null);
    resetCallSelf();
  });
});

const actions = (): AvatarPaletteActions => ({
  config: DEFAULT_AVATAR_CONFIG,
  onChange: vi.fn(),
  onRandomise: vi.fn(),
  onReaction: vi.fn(),
  onBurst: vi.fn(),
  status: null,
  onSetStatus: vi.fn(),
});

const callActions = () => ({
  join: vi.fn(),
  toggleMute: vi.fn(),
  toggleCamera: vi.fn(),
  toggleScreen: vi.fn(),
  raiseHand: vi.fn(),
  lowerHand: vi.fn(),
});

const strip = (over: Partial<AvatarPaletteProps> = {}) => {
  const props: AvatarPaletteProps = {
    ...actions(),
    onSendMessage: vi.fn(() => true),
    ...over,
  };
  render(<AvatarPalette {...props} />);
  return props;
};

describe('the strip', () => {
  it('shows the look, then the actions on the right', () => {
    strip();
    const look = screen.getByRole('toolbar', { name: 'Your Look' });
    const acts = screen.getByRole('toolbar', { name: 'Actions' });
    expect(
      within(look)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Gender', 'Clothes', 'Hair', 'Status']);
    expect(
      within(acts)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Actions', 'React']);
    // The actions come after the look along the strip.
    expect(look.compareDocumentPosition(acts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Owner, 2026-11-06: the Walk button is an Editor's way out, and a Participant and a Viewer never leave.
  it('has no selection-mode picker, for any role', () => {
    strip();
    expect(screen.queryByRole('button', { name: /Selection mode/ })).toBeNull();
  });

  // Owner, 2026-11-07: the call's buttons left the palette for the Call dock, bottom centre (docs/specs/008-canvas/
  // avatar-mode.md "The Call dock").
  it('holds no call group, even with a call on offer: the look comes first', () => {
    strip();
    act(() => {
      setCallActions(callActions());
      setCallSelf({ available: true, canSpeak: true, phase: 'live', mic: 'open' });
    });
    expect(screen.queryByRole('group', { name: 'Call' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mute' })).toBeNull();
    const card = document.querySelector('[data-tour-id="palette"]')!;
    expect(card.firstElementChild?.hasAttribute('data-strip-divider')).toBe(false);
  });

  it('draws no call group and no stray divider with no call and nothing to preview', () => {
    strip();
    expect(screen.queryByRole('group', { name: 'Call' })).toBeNull();
    const card = document.querySelector('[data-tour-id="palette"]')!;
    expect(card.firstElementChild?.hasAttribute('data-strip-divider')).toBe(false);
  });

  it('leaves Do Not Disturb to the Call dock', () => {
    strip({ status: 'dnd' });
    act(() => {
      setCallActions(callActions());
      setCallSelf({ available: true, canSpeak: true, phase: 'live', mic: 'open' });
    });
    expect(screen.queryByRole('button', { name: 'Turn Off Do Not Disturb' })).toBeNull();
  });

  // The Screen Share group sits on the Call dock now, so sharing changes nothing in the strip.
  it('while you share: the look stays whole, an open look flyout stays open, and no Screen Share group', () => {
    strip();
    act(() => {
      setCallActions(callActions());
      setCallSelf({ available: true, canSpeak: true, phase: 'live', mic: 'open', canShare: true });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hair' }));
    expect(document.querySelector('[data-category-flyout]')).not.toBeNull();
    act(() => setCallSelf({ screen: 'on' }));
    expect(document.querySelector('[data-category-flyout]')).not.toBeNull();
    expect(
      within(screen.getByRole('toolbar', { name: 'Your Look' }))
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Gender', 'Clothes', 'Hair', 'Status']);
    expect(screen.queryByRole('group', { name: 'Screen Share' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stop Sharing' })).toBeNull();
  });

  it('turning the camera on changes nothing else in the strip (it has no controls of its own)', () => {
    strip();
    act(() => {
      setCallActions(callActions());
      setCallSelf({ available: true, canSpeak: true, phase: 'live', mic: 'open', camera: 'on' });
    });
    expect(screen.queryByRole('group', { name: 'Screen Share' })).toBeNull();
    expect(
      within(screen.getByRole('toolbar', { name: 'Your Look' }))
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Gender', 'Clothes', 'Hair', 'Status']);
  });

  it('offers Say only to someone who may speak', () => {
    strip({ onSendMessage: undefined });
    expect(screen.queryByRole('button', { name: 'Say something' })).toBeNull();
    cleanup();
    strip();
    expect(screen.getByRole('button', { name: 'Say something' })).toBeTruthy();
  });

  it('carries the tour anchors', () => {
    strip();
    for (const id of ['palette', 'avatar-character', 'avatar-actions', 'avatar-message'])
      expect(document.querySelector(`[data-tour-id="${id}"]`), id).not.toBeNull();
  });

  it('opens a category flyout on a press', () => {
    strip();
    fireEvent.click(screen.getByRole('button', { name: 'Clothes' }));
    expect(document.querySelector('[data-category-flyout]')).not.toBeNull();
  });

  it('opens Say, and Escape closes it without reaching the editor (which would leave the mode)', () => {
    strip();
    fireEvent.click(screen.getByRole('button', { name: 'Say something' }));
    expect(document.querySelector('[data-avatar-say]')).not.toBeNull();
    const editor = vi.fn();
    window.addEventListener('keydown', editor);
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    window.removeEventListener('keydown', editor);
    expect(document.querySelector('[data-avatar-say]')).toBeNull();
    expect(editor).not.toHaveBeenCalled();
  });

  it('Escape in the message field closes Say alone, never the mode, and hands focus back to Say', () => {
    strip();
    const sayButton = screen.getByRole('button', { name: 'Say something' });
    fireEvent.click(sayButton);
    const popover = document.querySelector<HTMLElement>('[data-avatar-say]')!;
    // The field loads on demand; a typing target inside the popover stands in for it.
    const field = document.createElement('textarea');
    popover.appendChild(field);
    const editor = vi.fn();
    window.addEventListener('keydown', editor);
    act(() => {
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    window.removeEventListener('keydown', editor);
    expect(document.querySelector('[data-avatar-say]')).toBeNull();
    expect(editor).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(sayButton);
  });

  it('Say is a dialog named Say Something, as a flyout names itself', () => {
    strip();
    fireEvent.click(screen.getByRole('button', { name: 'Say something' }));
    expect(screen.getByRole('dialog', { name: 'Say Something' })).toBeTruthy();
  });

  it('hangs the preview card beside an open flyout, its own card, a press on it not outside', () => {
    strip();
    expect(document.querySelector('[data-avatar-preview]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clothes' }));
    const card = document.querySelector('[data-category-flyout-side]');
    expect(card).not.toBeNull();
    expect(card?.querySelector('[data-avatar-preview]')).not.toBeNull();
    // A press on it keeps the flyout open.
    fireEvent.pointerDown(card!);
    expect(document.querySelector('[data-category-flyout]')).not.toBeNull();
  });

  // Owner, 2026-11-07: "it scrolls so its not an issue that they don't all fit on screen".
  it('names the look, the actions and Say on a phone row, where they swipe', () => {
    mobile.value = true;
    strip({ leading: null });
    const look = screen.getByRole('toolbar', { name: 'Your Look' });
    expect(within(look).getByRole('button', { name: 'Gender' }).textContent).toContain('Gender');
    expect(screen.getByRole('button', { name: 'React' }).textContent).toContain('React');
    expect(screen.getByRole('button', { name: 'Say something' }).textContent).toBe('Say');
  });

  it('shows glyphs alone on a phone outside the row', () => {
    mobile.value = true;
    strip();
    expect(screen.getByRole('button', { name: 'Gender' }).textContent).not.toContain('Gender');
    expect(screen.getByRole('button', { name: 'Say something' }).textContent).toBe('');
  });

  it('hides, not unmounts, with the chrome away', () => {
    strip({ hidden: true });
    expect(document.querySelector('[data-avatar-palette]')?.className).toMatch(/\bhidden\b/);
  });
});

const flyout = (id: (typeof AVATAR_PALETTE_CATEGORIES)[number]['id'], a = actions()) => {
  const category = AVATAR_PALETTE_CATEGORIES.find((c) => c.id === id)!;
  render(
    <AvatarPaletteFlyout
      category={category}
      icon={null}
      actions={a}
      mobile={false}
      focusFirst={false}
    />,
  );
  return { a };
};

describe('the look flyouts', () => {
  it('Clothes: every outfit as a tile in Title Case, the current one pressed; a pick applies and stays open', () => {
    const { a } = flyout('clothes');
    const tiles = screen.getAllByRole('button');
    expect(tiles).toHaveLength(AVATAR_CLOTHING.length);
    expect(screen.getByRole('button', { name: 'T-Shirt' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lab Coat' }));
    expect(a.onChange).toHaveBeenCalledWith('clothing', 'labcoat');
  });

  it('Hair: every style, then the Hair Colour swatches at the bottom', () => {
    const { a } = flyout('hair');
    expect(screen.getAllByRole('button')).toHaveLength(
      AVATAR_HAIR.length + AVATAR_HAIR_COLOURS.length,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Top Knot' }));
    expect(a.onChange).toHaveBeenCalledWith('hair', 'topknot');
    // Owner, 2026-11-06: "Let me change hair color in the hair menu - at the bottom".
    const regions = screen.getAllByRole('region');
    expect(regions.at(-1)?.getAttribute('aria-label')).toBe('Hair Colour');
    const swatches = within(screen.getByRole('region', { name: 'Hair Colour' })).getAllByRole(
      'button',
    );
    expect(swatches.map((b) => b.getAttribute('aria-label'))).toEqual(
      AVATAR_HAIR_COLOURS.map((c) => c.label),
    );
    // The default config wears Brown; it shows pressed, and the rest do not.
    expect(
      swatches
        .filter((b) => b.getAttribute('aria-pressed') === 'true')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Brown']);
    expect(swatches.every((b) => b.className.includes('cursor-pointer'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Pink' }));
    expect(a.onChange).toHaveBeenCalledWith('hairColour', 'pink');
  });

  it('Hair: a config without a hair colour (an older build) shows Brown pressed', () => {
    const { hairColour: _, ...older } = DEFAULT_AVATAR_CONFIG;
    flyout('hair', { ...actions(), config: older });
    expect(screen.getByRole('button', { name: 'Brown' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('Gender (id character): Randomise and gender; no Size in livehuddle', () => {
    const { a } = flyout('character');
    fireEvent.click(screen.getByRole('button', { name: /Randomise/ }));
    expect(a.onRandomise).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Female' }));
    expect(a.onChange).toHaveBeenCalledWith('gender', 'female');
    expect(screen.queryByRole('button', { name: 'Tall' })).toBeNull();
  });

  it('Status: sets one, None clears it, Do Not Disturb is offered, and Jukebox Music lives here', () => {
    const { a } = flyout('status');
    fireEvent.click(screen.getByRole('button', { name: /^Focusing/ }));
    expect(a.onSetStatus).toHaveBeenLastCalledWith('focus');
    fireEvent.click(screen.getByRole('button', { name: /^None/ }));
    expect(a.onSetStatus).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('button', { name: /^Do Not Disturb/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Jukebox Music/ })).toBeTruthy();
  });

  // Owner, 2026-11-06: "The status menu is long, why not a wider menu like other categories, with subcategories".
  // Work Item 614: four to a row, the dot before the name rather than in a plate, so the whole flyout fits at 1280x720.
  it('Status: every status in its named group, four to a row (two on a phone), each with its line, Sound last', () => {
    flyout('status');
    const groups = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(groups).toEqual(['Availability', 'Activity', 'Mood', 'Sound']);
    for (const g of AVATAR_STATUS_GROUPS) {
      const region = screen.getByRole('region', { name: g.name });
      expect(region.querySelector('ul')?.className.split(' ')).toEqual(
        expect.arrayContaining(['grid-cols-2', 'sm:grid-cols-4']),
      );
      for (const s of g.statuses) {
        const card = within(region).getByRole('button', { name: new RegExp(`^${s.label}`) });
        expect(card.textContent).toContain(s.line);
        // No square plate: the card's first child is the words, the dot inside the name's row.
        expect(card.querySelector(':scope > .h-9')).toBeNull();
      }
    }
    // None leads the first group; every status the product offers is listed once.
    const choices = [...document.querySelectorAll('[data-status-choice]')].map((el) =>
      el.getAttribute('data-status-choice'),
    );
    expect(choices).toEqual(['none', ...AVATAR_CALL_STATUSES.map((s) => s.id)]);
    expect(
      within(screen.getByRole('region', { name: 'Mood' })).getByRole('button', { name: /^Angry/ }),
    ).toBeTruthy();
  });

  it('Status: setting Angry, and pointing at it previews it', () => {
    const { a } = flyout('status');
    const angry = screen.getByRole('button', { name: /^Angry/ });
    fireEvent.pointerEnter(angry, { pointerType: 'mouse' });
    expect(getAvatarPreview()).toMatchObject({ kind: 'status', status: 'angry', label: 'Angry' });
    fireEvent.click(angry);
    expect(a.onSetStatus).toHaveBeenLastCalledWith('angry');
  });
});

describe('the action flyouts', () => {
  it('Actions (id behaviour): a press plays it and the flyout stays open; each shows its key', () => {
    const { a } = flyout('behaviour');
    const wave = screen.getByRole('button', { name: /Wave/ });
    expect(wave.getAttribute('aria-keyshortcuts')).toBe('W');
    fireEvent.click(wave);
    expect(a.onReaction).toHaveBeenCalledWith('wave');
    expect(screen.getByRole('button', { name: /Jumping Jacks/ })).toBeTruthy();
  });

  it('React (id reactions): a press throws the burst and the flyout stays open', () => {
    const { a } = flyout('reactions');
    fireEvent.click(screen.getByRole('button', { name: /Confetti/ }));
    expect(a.onBurst).toHaveBeenCalledWith('confetti');
    expect(screen.getByRole('button', { name: /Confetti/ })).toBeTruthy();
  });
});

describe('the preview (docs/specs/008-canvas/avatar-mode.md "The preview, beside the flyout")', () => {
  afterEach(() => act(() => setAvatarPreview(null)));

  it('fits only where the window has room right of the flyout, 8 px clear of the edge', () => {
    // The flyout's right edge at 1000: the card needs 8 + 208 + 8 more.
    expect(previewFits(1000, 0, 1224)).toBe(true);
    expect(previewFits(1000, 0, 1223)).toBe(false);
    // A flyout hung further in from the strip's right edge leaves the room.
    expect(previewFits(1100, 100, 1224)).toBe(true);
  });

  it('pointing at an outfit tries it on, leaving shows your own look again; a press still applies it', () => {
    const { a } = flyout('clothes');
    const coat = screen.getByRole('button', { name: 'Lab Coat' });
    fireEvent.pointerEnter(coat, { pointerType: 'mouse' });
    expect(getAvatarPreview()).toMatchObject({
      kind: 'look',
      patch: { clothing: 'labcoat' },
      label: 'Lab Coat',
    });
    fireEvent.pointerLeave(coat, { pointerType: 'mouse' });
    expect(getAvatarPreview()).toBeNull();
    fireEvent.click(coat);
    expect(a.onChange).toHaveBeenCalledWith('clothing', 'labcoat');
  });

  it('focusing a status, a Behaviour or a Reaction previews it too', () => {
    flyout('status');
    fireEvent.focus(screen.getByRole('button', { name: /^Focusing/ }));
    expect(getAvatarPreview()).toMatchObject({ kind: 'status', status: 'focus' });
    cleanup();
    flyout('behaviour');
    fireEvent.focus(screen.getByRole('button', { name: /Wave/ }));
    expect(getAvatarPreview()).toMatchObject({ kind: 'behaviour', id: 'wave' });
    cleanup();
    flyout('reactions');
    fireEvent.focus(screen.getByRole('button', { name: /Hearts/ }));
    expect(getAvatarPreview()).toMatchObject({ kind: 'reaction', id: 'hearts' });
  });

  it('pointing at a hair colour tries it on, and the card draws the hair in it', () => {
    flyout('hair');
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Blue' }), { pointerType: 'mouse' });
    expect(getAvatarPreview()).toMatchObject({
      kind: 'look',
      patch: { hairColour: 'blue' },
      label: 'Blue',
    });
    cleanup();
    render(<AvatarPalettePreview config={DEFAULT_AVATAR_CONFIG} status={null} />);
    act(() => setAvatarPreview({ kind: 'look', patch: { hairColour: 'blue' }, label: 'Blue' }));
    const blue = AVATAR_HAIR_COLOURS.find((c) => c.id === 'blue')!.hex;
    expect(document.querySelector(`[data-avatar-preview-body] rect[fill="${blue}"]`)).toBeTruthy();
    expect(screen.getByText('Click to wear it.')).toBeTruthy();
  });

  it('a finger does not preview (its tap is a pick)', () => {
    flyout('hair');
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Afro' }), { pointerType: 'touch' });
    expect(getAvatarPreview()).toBeNull();
  });

  it('the flyout closing ends the preview', () => {
    flyout('clothes');
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Hoodie' }), {
      pointerType: 'mouse',
    });
    expect(getAvatarPreview()).not.toBeNull();
    cleanup();
    expect(getAvatarPreview()).toBeNull();
  });

  it('the card captions your character at rest, and names the option tried on', () => {
    render(<AvatarPalettePreview config={DEFAULT_AVATAR_CONFIG} status={null} />);
    expect(screen.getByText('Your Character')).toBeTruthy();
    expect(screen.getByText('Point at an option to try it on.')).toBeTruthy();
    act(() => setAvatarPreview({ kind: 'status', status: 'away', label: 'Away' }));
    expect(screen.getAllByText('Away').length).toBeGreaterThan(0);
    expect(screen.getByText('Click to set it.')).toBeTruthy();
    // Hidden from assistive tech: the options already say what they are.
    expect(document.querySelector('[data-avatar-preview-body]')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});
