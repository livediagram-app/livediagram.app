// @vitest-environment jsdom

// A rich label keeps its element's face on the wrapper its runs inherit from.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { BoxedElement } from '@liveplanner/project';
import { RichLabel } from './element-label-views';

afterEach(() => cleanup());

const el = {
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
} as BoxedElement;

describe('rich label font', () => {
  it('keeps the font', () => {
    const { container } = render(
      <RichLabel
        runs={[{ text: 'Hi', bold: true }]}
        element={el}
        textSize="md"
        alignX="center"
        alignY="middle"
        padding={0}
        fontFamily="Lora, serif"
        multiline={false}
      />,
    );
    const inner = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(inner.style.fontFamily).toContain('Lora');
  });
});
