// @vitest-environment jsdom

// A rich label keeps its element's face with or without wordmark type
// (docs/specs/007-editor/logo-pages.md "Wordmark type"): the wordmark CSS adds tracking and weight
// only, never an undefined font-family over the label's own.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { BoxedElement } from '@livediagram/document';
import { RichLabel } from './element-label-views';
import { wordmarkTextCss } from './label-style';

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
  it('keeps the font with an empty wordmark style', () => {
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
        wordmark={{}}
      />,
    );
    const inner = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(inner.style.fontFamily).toContain('Lora');
  });

  it('adds only tracking and weight', () => {
    expect(wordmarkTextCss({})).toEqual({});
    expect(wordmarkTextCss({ letterSpacing: 0.1, weight: 500, fontFamily: 'X' })).toEqual({
      letterSpacing: '0.1em',
      fontWeight: 500,
    });
  });
});
