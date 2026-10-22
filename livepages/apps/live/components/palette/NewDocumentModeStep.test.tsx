// @vitest-environment jsdom

// The New Document wizard's mode step (docs/specs/007-editor/new-document-route.md "Choosing a mode"): five cards of
// one build, three then two, each printing its number key, with no template badges; 1 to 5 choose a card.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EDITOR_MODES, editorModeLabel } from '@livepages/document';
import { popularKindsFor, TEMPLATES } from '@livepages/templates';
import { NEW_DOCUMENT_MODES, NewDocumentModeStep, modeCardSpan } from './NewDocumentModeStep';

afterEach(cleanup);

const cards = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-new-mode]'));

describe('NewDocumentModeStep', () => {
  it('shows the five modes in the catalogue order, Diagram first', () => {
    render(<NewDocumentModeStep selected={null} onChoose={vi.fn()} />);
    expect(cards().map((c) => c.dataset.newMode)).toEqual([...EDITOR_MODES]);
    expect(NEW_DOCUMENT_MODES[0]).toBe('diagram');
  });

  it('prints each card’s number key, 1 to 5, and names it as a shortcut', () => {
    render(<NewDocumentModeStep selected={null} onChoose={vi.fn()} />);
    cards().forEach((card, i) => {
      const key = card.querySelector('[data-mode-key]')!;
      expect(key.textContent).toBe(String(i + 1));
      expect(key.getAttribute('aria-hidden')).toBe('true');
      expect(card.getAttribute('aria-keyshortcuts')).toBe(String(i + 1));
    });
  });

  it('carries no template badges', () => {
    render(<NewDocumentModeStep selected={null} onChoose={vi.fn()} />);
    for (const mode of NEW_DOCUMENT_MODES) {
      const card = document.querySelector(`[data-new-mode="${mode}"]`)!;
      const titles = popularKindsFor(mode).map((k) => TEMPLATES.find((t) => t.kind === k)?.title);
      // The visible text is the name, the number and the pitch: no template title rides along.
      const visible = Array.from(card.querySelectorAll('span'))
        .filter((el) => !el.closest('svg') && el.children.length === 0)
        .map((el) => el.textContent);
      for (const title of titles) if (title) expect(visible).not.toContain(title);
    }
  });

  it('builds every card alike, Diagram included: three then two at one height', () => {
    render(<NewDocumentModeStep selected={null} onChoose={vi.fn()} />);
    const [diagram, ...rest] = cards();
    for (const card of rest) expect(card.className).toContain('flex-col');
    expect(diagram!.className).toContain('flex-col');
    expect(diagram!.className).not.toMatch(/sm:flex-row/);
    expect(cards().map((c) => c.className.match(/sm:col-span-\d/)?.[0])).toEqual([
      'sm:col-span-2',
      'sm:col-span-2',
      'sm:col-span-2',
      'sm:col-span-3',
      'sm:col-span-3',
    ]);
    expect([0, 1, 2, 3, 4].map(modeCardSpan)).toEqual(
      cards().map((c) => c.className.match(/sm:col-span-\d/)?.[0]),
    );
    expect(diagram!.parentElement!.className).toMatch(/sm:grid-cols-6/);
    expect(diagram!.parentElement!.className).toMatch(/sm:auto-rows-fr/);
  });

  it.each(EDITOR_MODES.map((mode, i) => [String(i + 1), mode] as const))(
    'chooses with its number key: %s picks %s',
    (key, mode) => {
      const onChoose = vi.fn();
      render(<NewDocumentModeStep selected={null} onChoose={onChoose} />);
      fireEvent.keyDown(screen.getByRole('group'), { key });
      expect(onChoose).toHaveBeenCalledWith(mode);
    },
  );

  it('ignores 0, 6 and letters', () => {
    const onChoose = vi.fn();
    render(<NewDocumentModeStep selected={null} onChoose={onChoose} />);
    for (const key of ['0', '6', 'a']) fireEvent.keyDown(screen.getByRole('group'), { key });
    expect(onChoose).not.toHaveBeenCalled();
  });

  // After a click on the backdrop the focus is on the page, not a card: the keys still choose.
  it('chooses with a number key pressed anywhere on the page, once', () => {
    const onChoose = vi.fn();
    render(<NewDocumentModeStep selected={null} onChoose={onChoose} />);
    fireEvent.keyDown(document.body, { key: '2' });
    expect(onChoose).toHaveBeenCalledExactlyOnceWith('draw');
    fireEvent.keyDown(cards()[0]!, { key: '3' });
    expect(onChoose).toHaveBeenCalledTimes(2);
    expect(onChoose).toHaveBeenLastCalledWith('workshop');
  });

  it('leaves a digit typed in a field, or in a chord, alone', () => {
    const onChoose = vi.fn();
    render(
      <>
        <input aria-label="Elsewhere" />
        <NewDocumentModeStep selected={null} onChoose={onChoose} />
      </>,
    );
    fireEvent.keyDown(screen.getByLabelText('Elsewhere'), { key: '2' });
    fireEvent.keyDown(document.body, { key: '2', metaKey: true });
    fireEvent.keyDown(document.body, { key: '2', ctrlKey: true });
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('chooses on a click and moves focus with the arrows, wrapping', () => {
    const onChoose = vi.fn();
    render(<NewDocumentModeStep selected="draw" onChoose={onChoose} />);
    const [diagram, draw] = cards();
    expect(draw!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`^${editorModeLabel('plan')}:`) }),
    );
    expect(onChoose).toHaveBeenCalledWith('plan');
    diagram!.focus();
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(cards()[4]);
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(diagram);
  });
});
