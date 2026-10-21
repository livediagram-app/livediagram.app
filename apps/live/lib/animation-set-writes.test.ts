import { describe, expect, it } from 'vitest';
import { createShape, createSticky, createText, type Element } from '@liveplanner/document';
import {
  setAnimationState,
  withSetAnimation,
  withSetAnimationRepeat,
  withSetAnimationSpeed,
  withoutAnimations,
} from './animation-set-writes';

const image = { id: 'img', type: 'image', x: 0, y: 0, width: 10, height: 10 } as unknown as Element;

describe('animation set writes', () => {
  it('writes a body set only to its members, leaving others the same reference', () => {
    const sticky = createSticky(0, 0);
    const shape = createShape('square', 0, 0);
    expect(withSetAnimation(sticky, 'sticky', 'flutter')).toMatchObject({ animation: 'flutter' });
    expect(withSetAnimation(shape, 'sticky', 'flutter')).toBe(shape);
    expect(withSetAnimation(image, 'shape', 'pulse')).toBe(image);
  });

  // docs/specs/028-animation/element-animations.md "Shape motions".
  it('writes a Shape motion to an element beside its own set, replacing its own value', () => {
    expect(withSetAnimation(image, 'shape', 'bounce')).toMatchObject({ animation: 'bounce' });
    const ken = { ...image, animation: 'kenburns' } as Element;
    expect(withSetAnimation(ken, 'shape', 'bounce')).toMatchObject({ animation: 'bounce' });
    const icon = createShape('icon', 0, 0);
    expect(withSetAnimation(icon, 'shape', 'bounce')).toBe(icon);
  });

  it('None clears only its own section’s value', () => {
    const bounce = { ...image, animation: 'bounce' } as Element;
    expect(withSetAnimation(bounce, 'media', null)).toBe(bounce);
    expect('animation' in withSetAnimation(bounce, 'shape', null)).toBe(false);
    const ken = { ...image, animation: 'kenburns' } as Element;
    expect(withSetAnimation(ken, 'shape', null)).toBe(ken);
    expect('animation' in withSetAnimation(ken, 'media', null)).toBe(false);
  });

  it('reads a body value in the section it belongs to', () => {
    const bounce = { ...image, animation: 'bounce' } as Element;
    expect(setAnimationState([bounce], 'shape')?.value).toBe('bounce');
    expect(setAnimationState([bounce], 'media')?.value).toBeNull();
    const ken = { ...image, animation: 'kenburns' } as Element;
    expect(setAnimationState([ken], 'shape')?.value).toBeNull();
    expect(setAnimationState([ken], 'media')?.value).toBe('kenburns');
  });

  it('writes Text to any element that carries words, beside its body animation', () => {
    const shape = { ...createShape('square', 0, 0), animation: 'pulse' as const };
    const next = withSetAnimation(shape, 'text', 'typewriter');
    expect(next).toMatchObject({ animation: 'pulse', textAnimation: 'typewriter' });
    expect(withSetAnimation(image, 'text', 'typewriter')).toBe(image);
  });

  it('clears a text element’s legacy body trio when Text is picked', () => {
    const text = {
      ...createText(0, 0),
      animation: 'bounce' as const,
      animationSpeed: 'fast' as const,
      animationRepeat: false,
    };
    const next = withSetAnimation(text, 'text', 'wave') as Record<string, unknown>;
    expect(next.textAnimation).toBe('wave');
    expect('animation' in next).toBe(false);
    expect('animationSpeed' in next).toBe(false);
    expect('animationRepeat' in next).toBe(false);
    // The Speed chosen for the legacy animation (in the Text section) carries over.
    expect(next.textAnimationSpeed).toBe('fast');
  });

  it('None removes the field rather than storing undefined', () => {
    const sticky = { ...createSticky(0, 0), animation: 'sway' as const };
    expect('animation' in withSetAnimation(sticky, 'sticky', null)).toBe(false);
  });

  it('stores Speed per set, and Repeat only when it differs from the set default', () => {
    const shape = createShape('square', 0, 0);
    expect(withSetAnimationSpeed(shape, 'text', 'fast')).toMatchObject({
      textAnimationSpeed: 'fast',
    });
    expect(withSetAnimationSpeed(shape, 'shape', 'fast')).toMatchObject({ animationSpeed: 'fast' });
    // Body animations loop by default: Repeat is stored only when off.
    expect(withSetAnimationRepeat(shape, 'shape', false)).toMatchObject({ animationRepeat: false });
    expect('animationRepeat' in withSetAnimationRepeat(shape, 'shape', true)).toBe(false);
    // Text plays once by default: Repeat is stored only when on.
    expect(withSetAnimationRepeat(shape, 'text', true)).toMatchObject({
      textAnimationRepeat: true,
    });
    const back = withSetAnimationRepeat({ ...shape, textAnimationRepeat: true }, 'text', false);
    expect('textAnimationRepeat' in back).toBe(false);
  });

  it('reads Text as playing once unless Repeat is on, and body animations as looping', () => {
    const text = { ...createText(0, 0), textAnimation: 'wave' as const };
    expect(setAnimationState([text], 'text')?.repeat).toBe(false);
    expect(setAnimationState([{ ...text, textAnimationRepeat: true }], 'text')?.repeat).toBe(true);
    const sticky = { ...createSticky(0, 0), animation: 'sway' as const };
    expect(setAnimationState([sticky], 'sticky')?.repeat).toBe(true);
  });

  it('Clear animation removes body and Text together', () => {
    const shape = {
      ...createShape('square', 0, 0),
      animation: 'pulse' as const,
      textAnimation: 'wave' as const,
    };
    const next = withoutAnimations(shape) as Record<string, unknown>;
    expect(next.animation).toBeUndefined();
    expect(next.textAnimation).toBeUndefined();
  });

  it('reads a category from its first member, and a text element’s legacy value as Text', () => {
    const text = { ...createText(0, 0), animation: 'trace' as const };
    const sticky = { ...createSticky(0, 0), animation: 'peel' as const, animationRepeat: false };
    expect(setAnimationState([image, sticky], 'sticky')).toEqual({
      value: 'peel',
      speed: undefined,
      repeat: false,
      legacy: false,
    });
    expect(setAnimationState([text], 'text')).toMatchObject({ value: 'trace', legacy: true });
    const glow = {
      ...createText(0, 0),
      animation: 'glow' as const,
      textAnimation: 'wave' as const,
    };
    expect(setAnimationState([glow], 'text')).toMatchObject({ value: 'wave', legacy: false });
    expect(setAnimationState([image], 'text')).toBeUndefined();
  });
});
