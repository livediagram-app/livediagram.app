// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EMPTY_TEXT_PROMPT, EMPTY_TEXT_PROMPT_OPACITY, EmptyTextPrompt } from './EmptyTextPrompt';

// liveworkspace's template-examples blueprint "The empty text prompt": a faint "Text" at the text's size and
// alignment, canvas chrome a snapshot can drop, never read aloud and never in the way of a click.
afterEach(cleanup);

const promptIn = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-empty-text-prompt]')!;

describe('EmptyTextPrompt', () => {
  it("draws the editor's own word, faint, at the size and alignment given", () => {
    const { container } = render(
      <EmptyTextPrompt px={26} alignX="right" alignY="bottom" padding={6} fontFamily="serif" />,
    );
    const prompt = promptIn(container);
    expect(prompt.textContent).toBe(EMPTY_TEXT_PROMPT);
    expect(EMPTY_TEXT_PROMPT).toBe('Text');
    expect(prompt.style.fontSize).toBe('26px');
    expect(prompt.style.alignItems).toBe('flex-end');
    expect(prompt.style.opacity).toBe(String(EMPTY_TEXT_PROMPT_OPACITY));
    expect(prompt.style.fontFamily).toBe('serif');
    expect((prompt.firstElementChild as HTMLElement).style.textAlign).toBe('right');
  });

  it('is hidden from screen readers, takes no pointer, and carries a snapshot omit mark when given one', () => {
    const { container } = render(
      <EmptyTextPrompt
        px={14}
        alignX="left"
        alignY="top"
        padding="2px 4px"
        omitAttr="data-gif-omit"
      />,
    );
    const prompt = promptIn(container);
    expect(prompt.getAttribute('aria-hidden')).toBe('true');
    expect(prompt.className).toContain('pointer-events-none');
    expect(prompt.hasAttribute('data-gif-omit')).toBe(true);
    expect(prompt.style.fontFamily).toBe('');
  });
});
