// @vitest-environment jsdom

// His line typed out (docs/specs/008-canvas/receptionist.md "Asking the Receptionist": "He types his lines").

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TypedLine, TYPE_CPS, typedLength } from './TypedLine';

const reduced = vi.hoisted(() => ({ on: false }));
vi.mock('@/lib/reduced-motion', () => ({ useReducedMotion: () => reduced.on }));

afterEach(() => {
  cleanup();
  reduced.on = false;
  vi.useRealTimers();
});

const typed = (root: HTMLElement) => root.querySelector('[data-typed]')!;

describe('typedLength', () => {
  it('counts letters at TYPE_CPS, never past the line or below nothing', () => {
    expect(typedLength(40, 0)).toBe(0);
    expect(typedLength(40, 1000 / TYPE_CPS)).toBe(1);
    expect(typedLength(40, 100_000)).toBe(40);
    expect(typedLength(40, -5)).toBe(0);
  });
});

describe('TypedLine', () => {
  it('types a line out a letter at a time, laid out whole, and heard whole', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const { container, rerender } = render(<TypedLine text="Hello there" />);
    expect(typed(container).textContent).toBe('');
    expect(typed(container).getAttribute('data-typed')).toBe('typing');
    expect(container.querySelector('.sr-only')!.textContent).toBe('Hello there');
    expect(container.querySelector('.invisible')!.textContent).toBe('Hello there');
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const part = typed(container).textContent ?? '';
    expect(part.length).toBeGreaterThan(0);
    expect('Hello there'.startsWith(part)).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(typed(container).textContent).toBe('Hello there');
    expect(typed(container).getAttribute('data-typed')).toBe('done');
    // A new line starts again from nothing.
    rerender(<TypedLine text="Bye" />);
    expect(typed(container).textContent).toBe('');
  });

  it('shows the line whole under reduced motion', () => {
    reduced.on = true;
    const { container } = render(<TypedLine text="Hello there" />);
    expect(typed(container).textContent).toBe('Hello there');
  });
});
