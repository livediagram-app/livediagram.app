// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createShape, petArea, type Element } from '@livehuddle/document';
import {
  RECEPTION_REACH,
  petAreasOf,
  receptionAt,
  setPetAreas,
  useAtReception,
  usePetArea,
  useWorkdayPieces,
} from './useWorkdayPieces';

// docs/specs/009-elements/workday-pieces.md "Reception Desk" (the Welcome bubble) and "Pet Bed and its dog".

const at = (
  shape: 'reception-desk' | 'pet-bed' | 'room' | 'coffee-machine' | 'desk' | 'rug',
  id: string,
  x: number,
  y: number,
  w?: number,
  h?: number,
) =>
  ({
    ...createShape(shape, x, y),
    id,
    ...(w ? { width: w } : {}),
    ...(h ? { height: h } : {}),
  }) as Element;

const desk = { id: 'desk', x: 100, y: 100, width: 200, height: 112 };

describe('standing at a reception desk', () => {
  it('counts feet in front of the counter, across its width, up to the reach below it', () => {
    expect(receptionAt({ x: 200, y: 212 + RECEPTION_REACH }, [desk])).toBe('desk');
    expect(receptionAt({ x: 100, y: 200 }, [desk])).toBe('desk');
    expect(receptionAt({ x: 200, y: 212 + RECEPTION_REACH + 1 }, [desk])).toBeNull();
    // Behind the counter, or off its ends, is not at it.
    expect(receptionAt({ x: 200, y: 120 }, [desk])).toBeNull();
    expect(receptionAt({ x: 99, y: 220 }, [desk])).toBeNull();
  });

  it('counts a turned desk’s front on the side its counter faces, never below it', () => {
    // On its side (facing left): a tall desk, its counter's front down its left.
    const side = { id: 'side', x: 100, y: 100, width: 112, height: 200, chairFacing: 'e' as const };
    const footLeft = 100 + 112 * (4 / 112);
    expect(receptionAt({ x: footLeft - 10, y: 200 }, [side])).toBe('side');
    expect(receptionAt({ x: footLeft - RECEPTION_REACH - 1, y: 200 }, [side])).toBeNull();
    expect(receptionAt({ x: 150, y: 300 + 16 }, [side])).toBeNull();
    // Facing right, the mirror: its front down its right.
    const right = { ...side, id: 'right', chairFacing: 'w' as const };
    const footRight = 100 + 112 * (1 - 4 / 112);
    expect(receptionAt({ x: footRight + 10, y: 200 }, [right])).toBe('right');
    expect(receptionAt({ x: footLeft - 10, y: 200 }, [right])).toBeNull();
    // From behind (facing up): its front along the top of its counter.
    const back = { ...desk, id: 'back', chairFacing: 's' as const };
    const top = 100 + 112 * (52 / 112);
    expect(receptionAt({ x: 200, y: top - 10 }, [back])).toBe('back');
    expect(receptionAt({ x: 200, y: top - RECEPTION_REACH - 1 }, [back])).toBeNull();
    expect(receptionAt({ x: 200, y: 212 + 10 }, [back])).toBeNull();
  });

  it('shows the Welcome only while walking at the desk, and takes it away on leaving', () => {
    const elements = [at('reception-desk', 'desk', 100, 100)];
    const welcome = renderHook(() => useAtReception('desk'));
    const view = renderHook(
      (p: { active: boolean; feet: { x: number; y: number } | null }) =>
        useWorkdayPieces({ ...p, elements }),
      { initialProps: { active: true, feet: { x: 200, y: 230 } } },
    );
    welcome.rerender();
    expect(welcome.result.current).toBe(true);
    view.rerender({ active: true, feet: { x: 200, y: 900 } });
    welcome.rerender();
    expect(welcome.result.current).toBe(false);
    view.rerender({ active: true, feet: { x: 200, y: 230 } });
    view.rerender({ active: false, feet: { x: 200, y: 230 } });
    welcome.rerender();
    expect(welcome.result.current).toBe(false);
    view.rerender({ active: true, feet: { x: 200, y: 230 } });
    view.unmount();
    welcome.rerender();
    expect(welcome.result.current).toBe(false);
  });
});

describe("the dog's area", () => {
  it('finds each bed its room, or a circle round it, and publishes them without waking unchanged dogs', () => {
    const elements = [
      at('room', 'room', 0, 0, 600, 400),
      at('pet-bed', 'in-room', 100, 100),
      at('pet-bed', 'outside', 2000, 2000),
    ];
    const areas = petAreasOf(elements);
    expect(areas.get('in-room')?.kind).toBe('box');
    expect(areas.get('outside')).toEqual(petArea({ x: 2000, y: 2000, width: 72, height: 48 }, []));
    const dog = renderHook(() => usePetArea('in-room'));
    expect(dog.result.current).toBeNull();
    const view = renderHook(() => useWorkdayPieces({ active: false, feet: null, elements }));
    dog.rerender();
    const first = dog.result.current;
    expect(first?.kind).toBe('box');
    // The same areas again keep each object, so its dog does not re-render.
    setPetAreas(petAreasOf(elements));
    dog.rerender();
    expect(dog.result.current).toBe(first);
    view.unmount();
    dog.rerender();
    expect(dog.result.current).toBeNull();
  });

  it('keeps the dog clear of the pieces in its room, but walks it over a rug', () => {
    const elements = [
      at('room', 'room', 0, 0, 600, 400),
      at('pet-bed', 'bed', 100, 100),
      at('coffee-machine', 'coffee', 300, 60),
      at('desk', 'desk', 300, 200),
      at('rug', 'rug', 40, 240),
    ];
    const blocks = petAreasOf(elements).get('bed')?.blocks ?? [];
    const box = (id: string) => {
      const el = elements.find((e) => e.id === id) as Element & {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      return { x: el.x, y: el.y, width: el.width, height: el.height };
    };
    expect(blocks).toEqual([box('coffee'), box('desk')]);
    expect(petAreasOf([at('room', 'room', 0, 0, 600, 400)]).size).toBe(0);
  });
});
