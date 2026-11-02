// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
import { track } from '@/lib/telemetry';
import { finishFlip, flipCard, motionReduced, pictureCard } from './flashcard-flip';

// docs/specs/007-editor/flashcards.md "Flipping".
const a = { id: 'a', rect: { x: 0, y: 0, width: 900, height: 540 }, flow: 'fa' };
const b = { id: 'b', rect: { x: 1000, y: 0, width: 900, height: 540 }, flow: 'fb' };

type FakeAnimation = { onfinish: (() => void) | null; cancel: () => void; keyframes: Keyframe[] };
let animations: FakeAnimation[] = [];

function world() {
  document.body.innerHTML = `
    <div id="world">
      <div data-page-id="a" data-tour-id="page-name" style="left:0px"><button role="button" aria-label="Page settings">c</button></div>
      <div class="article-flow" data-article-flow="fa" role="textbox" contenteditable="true">Opening</div>
      <div data-page-id="b"></div>
      <div class="article-flow" data-article-flow="fb">Second</div>
    </div>`;
  return document.getElementById('world')!;
}

beforeEach(() => {
  animations = [];
  const animate = (keyframes: Keyframe[]) => {
    const anim: FakeAnimation = { onfinish: null, cancel: vi.fn(), keyframes };
    animations.push(anim);
    return anim;
  };
  Object.assign(HTMLElement.prototype, { animate });
  vi.mocked(track).mockClear();
});

afterEach(() => {
  finishFlip();
  document.body.innerHTML = '';
  document.documentElement.classList.remove('reduce-motion');
});

const flips = () => document.querySelectorAll('[data-flashcard-flip]');

describe('a picture of a card', () => {
  it('copies its sheet and writing, inert, with nothing other code finds the card by', () => {
    world();
    const picture = pictureCard(a)!;
    expect(picture.world.id).toBe('world');
    expect(picture.el.getAttribute('aria-hidden')).toBe('true');
    expect(picture.el.inert).toBe(true);
    expect(picture.el.textContent).toContain('Opening');
    expect(picture.el.querySelector('[data-page-id]')).toBeNull();
    expect(picture.el.querySelector('[data-article-flow]')).toBeNull();
    expect(picture.el.querySelector('[role]')).toBeNull();
    expect(picture.el.querySelector('[contenteditable]')).toBeNull();
    expect(picture.el.querySelector('[data-tour-id]')).toBeNull();
    expect(document.querySelectorAll('[data-page-id="a"]')).toHaveLength(1);
  });

  it('is the sheet alone without writing, and none for a card not drawn', () => {
    world();
    expect(pictureCard({ id: 'b', rect: b.rect })!.el.textContent).toBe('');
    expect(pictureCard({ ...a, id: 'gone' })).toBeNull();
  });
});

describe('the flip', () => {
  it('turns the card that was in front away over the new one, then takes its picture away', () => {
    world();
    flipCard(pictureCard(a), b, true, false);
    const [layer] = flips();
    expect(flips()).toHaveLength(1);
    expect((layer as HTMLElement).style.left).toBe('1000px');
    expect(animations).toHaveLength(1);
    expect(animations[0]!.keyframes[0]!.opacity).toBe(1);
    expect(animations[0]!.keyframes[1]!.opacity).toBe(0);
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'FlashcardFlip');
    animations[0]!.onfinish!();
    expect(flips()).toHaveLength(0);
  });

  it('back: brings the earlier card over the one that was in front', () => {
    world();
    flipCard(pictureCard(b), a, false, false);
    expect(flips()).toHaveLength(2);
    expect(animations[0]!.keyframes[0]!.opacity).toBe(0);
    expect(animations[0]!.keyframes[1]!.opacity).toBe(1);
  });

  it('back without a picture of the earlier card turns the old one away', () => {
    world();
    flipCard(pictureCard(b), { ...a, id: 'gone' }, false, false);
    expect(flips()).toHaveLength(1);
    expect(animations[0]!.keyframes[1]!.opacity).toBe(0);
  });

  it('finishes a flip under way before the next', () => {
    world();
    flipCard(pictureCard(a), b, true, false);
    flipCard(pictureCard(b), a, false, false);
    expect(animations[0]!.cancel).toHaveBeenCalled();
    expect(flips()).toHaveLength(2);
    // The first's own end, late, takes nothing of the second's away.
    animations[0]!.onfinish!();
    expect(flips()).toHaveLength(2);
  });

  it('draws nothing under reduced motion or without a picture', () => {
    world();
    flipCard(pictureCard(a), b, true, true);
    flipCard(null, b, true, false);
    expect(flips()).toHaveLength(0);
    expect(track).not.toHaveBeenCalled();
  });

  it('takes its picture away at once where nothing animates', () => {
    world();
    Object.assign(HTMLElement.prototype, { animate: undefined });
    flipCard(pictureCard(a), b, true, false);
    expect(flips()).toHaveLength(0);
  });
});

describe('reduced motion', () => {
  it('follows the editor’s own Reduce Motion and the device’s setting', () => {
    const matchMedia = vi.fn(() => ({ matches: false }));
    vi.stubGlobal('matchMedia', matchMedia);
    expect(motionReduced()).toBe(false);
    matchMedia.mockReturnValue({ matches: true });
    expect(motionReduced()).toBe(true);
    matchMedia.mockReturnValue({ matches: false });
    document.documentElement.classList.add('reduce-motion');
    expect(motionReduced()).toBe(true);
    vi.unstubAllGlobals();
  });
});
