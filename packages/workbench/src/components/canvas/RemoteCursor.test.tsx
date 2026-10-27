// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { configureWorkbench, resetWorkbenchForTests } from '../../bindings';
import { writeLocalStorageValue } from '../../hooks/ui/useLocalStorageValue';
import { testBindings } from '../../lib/testing/bindings';
import { CanvasZoomProvider } from './CanvasZoomContext';
import { RemoteCursor, RemoteCursors, type RemoteCursorRow } from './RemoteCursor';

afterEach(() => {
  resetWorkbenchForTests();
  window.localStorage.clear();
});

const paint = (color: string) => ({ '--identity': color }) as React.CSSProperties;
const ada: RemoteCursorRow = { id: 'a', name: 'Ada Lovelace', color: '#0ea5e9', x: 120, y: 40 };
const bo: RemoteCursorRow = { id: 'b', name: 'Bo', color: '#10b981', x: 300, y: 90 };

describe('RemoteCursor', () => {
  it('sits at its canvas point, counter-scaled to keep its size on screen, and never takes a click', () => {
    const { container } = render(<RemoteCursor cursor={ada} zoom={2} paint={paint} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.className).toContain('pointer-events-none');
    expect(root.className).not.toContain('opacity-0');
    expect(root.style.left).toBe('120px');
    expect(root.style.top).toBe('40px');
    expect(root.style.transform).toBe('scale(0.5)');
    expect(root.querySelector('svg')?.getAttribute('fill')).toBe('#0ea5e9');
    const pill = root.querySelector('span') as HTMLElement;
    expect(pill.textContent).toBe('Ada Lovelace');
    expect(pill.style.getPropertyValue('--identity')).toBe('#0ea5e9');
  });

  it("leads the pill with the person's picture when there is one", () => {
    const { container } = render(
      <RemoteCursor
        cursor={{ ...ada, picture: 'https://lh3.googleusercontent.com/a/abc=s96-c' }}
        zoom={1}
        paint={paint}
      />,
    );
    // The initials always render under the picture, so the pill is the same size loaded or not.
    expect(container.textContent).toBe('ALAda Lovelace');
  });

  it('fades out, still letting clicks through, while it steps aside', () => {
    const { container } = render(<RemoteCursor cursor={ada} zoom={1} paint={paint} faded />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('opacity-0');
    expect(root.className).toContain('pointer-events-none');
    expect(root.className).toContain('motion-safe:transition-opacity');
  });
});

describe('RemoteCursors', () => {
  it('draws every cursor at the canvas zoom', () => {
    configureWorkbench(testBindings({ hideCursorsKey: 'test:layer-a' }));
    const { container } = render(
      <CanvasZoomProvider zoom={4}>
        <RemoteCursors cursors={[ada, bo]} paint={paint} />
      </CanvasZoomProvider>,
    );
    const roots = [...container.querySelectorAll<HTMLElement>('[data-remote-cursor]')];
    expect(roots.map((r) => r.textContent)).toEqual(['Ada Lovelace', 'Bo']);
    expect(roots[0]!.style.transform).toBe('scale(0.25)');
  });

  it('draws none while this screen hides participant cursors, and all again when it stops', () => {
    configureWorkbench(testBindings({ hideCursorsKey: 'test:layer-b' }));
    const { container } = render(<RemoteCursors cursors={[ada, bo]} paint={paint} />);
    const drawn = () => container.querySelectorAll('[data-remote-cursor]').length;
    expect(drawn()).toBe(2);
    act(() => writeLocalStorageValue('test:layer-b', 'true'));
    expect(drawn()).toBe(0);
    act(() => writeLocalStorageValue('test:layer-b', 'false'));
    expect(drawn()).toBe(2);
  });
});
