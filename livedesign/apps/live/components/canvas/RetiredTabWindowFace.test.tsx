// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { coerceShapeKind, isValidElement, type ShapeElement } from '@livedesign/design';
import { RetiredTabWindowFace, retiredTabWindowName } from './RetiredTabWindowFace';

// docs/specs/009-elements/tab-window.md "A stored window".

afterEach(cleanup);

const stored = (windowTabId?: string) =>
  ({
    id: 'w',
    type: 'shape',
    shape: 'tab-window',
    x: 10,
    y: 20,
    width: 640,
    height: 360,
    label: '',
    ...(windowTabId ? { windowTabId } : {}),
  }) as ShapeElement;

const tabs = [
  { id: 't1', name: 'Slides' },
  { id: 't2', name: 'Architecture' },
  { id: 't3', name: '' },
];

describe('a stored tab window', () => {
  it('names the tab it showed, or says Tab Window when that tab is gone or was never chosen', () => {
    expect(retiredTabWindowName('t2', tabs)).toBe('Architecture');
    expect(retiredTabWindowName('t3', tabs)).toBe('Untitled tab');
    expect(retiredTabWindowName('gone', tabs)).toBe('Tab Window');
    expect(retiredTabWindowName(undefined, tabs)).toBe('Tab Window');
  });

  it('draws as a still frame with no controls', () => {
    const { container } = render(
      <RetiredTabWindowFace element={stored('t2')} surface="light" tabs={tabs} />,
    );
    const face = container.querySelector('[data-tab-window="retired"]');
    expect(face?.textContent).toBe('Architecture');
    expect(container.querySelectorAll('button, a, input')).toHaveLength(0);
  });

  it('still loads from a saved design, keeping its kind and its tab', () => {
    expect(isValidElement(stored('t2'))).toBe(true);
    expect(isValidElement(stored())).toBe(true);
    expect(coerceShapeKind('tab-window')).toBe('tab-window');
  });
});
