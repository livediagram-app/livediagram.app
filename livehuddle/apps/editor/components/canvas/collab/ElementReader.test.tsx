// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { ElementReader, useElementReader } from './ElementReader';

const box = (over: Record<string, unknown>) =>
  ({ id: 'e1', x: 0, y: 0, width: 200, height: 100, ...over }) as unknown as Element;

const noop = () => {};

describe('ElementReader', () => {
  it("reads a sticky's words at reading size, with nothing pressable but Close", () => {
    render(
      <ElementReader element={box({ type: 'sticky', label: 'Ship on Friday' })} onClose={noop} />,
    );
    expect(screen.getByRole('dialog', { name: /sticky note/i })).toBeTruthy();
    expect(screen.getByText('Ship on Friday').className).toContain('text-[20px]');
  });

  it('says when a text or sticky is empty', () => {
    render(<ElementReader element={box({ type: 'text', label: '  ' })} onClose={noop} />);
    expect(screen.getByText('Nothing written here yet.')).toBeTruthy();
  });

  it('shows an idle Screen, a silent Jukebox and a free Room Sign by what they would show', async () => {
    const { unmount } = render(
      <ElementReader element={box({ type: 'shape', shape: 'screen' })} onClose={noop} />,
    );
    expect(screen.getByText('Nothing on the Screen yet')).toBeTruthy();
    unmount();
    const jukebox = render(
      <ElementReader element={box({ type: 'shape', shape: 'jukebox' })} onClose={noop} />,
    );
    expect(screen.getByText('No music set')).toBeTruthy();
    jukebox.unmount();
    render(<ElementReader element={box({ type: 'shape', shape: 'room-sign' })} onClose={noop} />);
    // The Room Sign's door panel loads the first time one is read (web-performance.md "A piece's panel").
    expect(await screen.findByText('Free')).toBeTruthy();
  });

  it("says an image with nothing loaded has no picture, and shows the canvas's own source when it has one", () => {
    const { unmount } = render(<ElementReader element={box({ type: 'image' })} onClose={noop} />);
    expect(screen.getByText('No picture here yet')).toBeTruthy();
    unmount();
    const host = document.createElement('div');
    host.setAttribute('data-element-id', 'e1');
    const img = document.createElement('img');
    Object.defineProperty(img, 'currentSrc', { value: 'blob:pic' });
    host.appendChild(img);
    document.body.appendChild(host);
    render(<ElementReader element={box({ type: 'image' })} onClose={noop} />);
    expect(document.querySelector('[data-element-reader] img')?.getAttribute('src')).toBe(
      'blob:pic',
    );
    host.remove();
  });

  it('copies any other face, scaled up to fit, with its ids and main action stripped', () => {
    const host = document.createElement('div');
    host.setAttribute('data-element-id', 'e1');
    host.innerHTML = '<button data-piece-main="" id="x" tabindex="0">Row</button>';
    document.body.appendChild(host);
    render(
      <ElementReader
        element={box({ type: 'shape', shape: 'callout', label: 'Note' })}
        onClose={noop}
      />,
    );
    const reader = document.querySelector('[data-element-reader]')!;
    const copy = reader.querySelector('[aria-hidden="true"] button')!;
    expect(copy.textContent).toBe('Row');
    expect(copy.hasAttribute('data-piece-main')).toBe(false);
    expect(copy.hasAttribute('id')).toBe(false);
    expect(reader.querySelectorAll('[data-element-id]').length).toBe(0);
    // A 200 x 100 face in a 672-wide body: scaled 3x (the cap), not 3.36x.
    expect(reader.innerHTML).toContain('scale(3)');
    expect(screen.getByRole('dialog', { name: 'Note' })).toBeTruthy();
    host.remove();
  });
});

describe('useElementReader', () => {
  it('opens by id, follows the element, and closes when it is deleted or Close is pressed', () => {
    let elements: Element[] = [box({ type: 'sticky', label: 'One' })];
    const { result, rerender } = renderHook(() => useElementReader(elements));
    expect(result.current.reader).toBeNull();
    act(() => result.current.open('e1'));
    const view = render(<>{result.current.reader}</>);
    expect(screen.getByText('One')).toBeTruthy();
    fireEvent.click(
      screen.getAllByRole('button', { name: /close/i }).find((b) => b.tabIndex !== -1)!,
    );
    rerender();
    expect(result.current.reader).toBeNull();
    view.unmount();
    act(() => result.current.open('e1'));
    elements = [];
    rerender();
    expect(result.current.reader).toBeNull();
  });
});
