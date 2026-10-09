import { describe, expect, it } from 'vitest';
import { createShape, createSticky, createText, type Element } from '@livediagram/document';
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
    });
    expect(setAnimationState([text], 'text')?.value).toBe('trace');
    expect(setAnimationState([image], 'text')).toBeUndefined();
  });
});
