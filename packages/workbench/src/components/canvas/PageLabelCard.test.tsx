// @vitest-environment jsdom
// A page's label (PageLabelCard.tsx): its name before its size and kind, on the title bar's card, one press target.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageLabelCard } from './PageLabelCard';
import { TITLE_BAR_CARD_CLASS } from './PageTitleBar';

afterEach(() => cleanup());

const card = () => document.querySelector<HTMLElement>('[data-page-label]')!;

describe('PageLabelCard', () => {
  it('sets the name first, then the rest after a dot', () => {
    render(
      <PageLabelCard
        label="Title · Slide (16:9)"
        name="Title"
        rest="Slide (16:9)"
        onClick={() => {}}
      />,
    );
    const button = screen.getByRole('button');
    expect(button.textContent).toBe('Title · Slide (16:9)');
    expect(button.firstElementChild!.textContent).toBe('Title');
    expect(button.firstElementChild!.className).toMatch(/font-semibold/);
  });

  it('shows the rest alone when the page has no name, and the name alone with no rest', () => {
    const { rerender } = render(
      <PageLabelCard label="A4 · Portrait" name="" rest="A4 · Portrait" onClick={() => {}} />,
    );
    expect(screen.getByRole('button').textContent).toBe('A4 · Portrait');
    rerender(<PageLabelCard label="Cover" name="Cover" rest="" onClick={() => {}} />);
    expect(screen.getByRole('button').textContent).toBe('Cover');
  });

  // The owner's report: on a stack the bare text sat over the fanned pages' edges and could not be read.
  it('wears the title bar card, near-solid, with no backdrop blur', () => {
    render(<PageLabelCard label="Title" name="Title" rest="" onClick={() => {}} />);
    for (const token of TITLE_BAR_CARD_CLASS.split(' ')) expect(card().classList).toContain(token);
    expect(card().className).toMatch(/bg-white\/95/);
    expect(card().className).not.toMatch(/backdrop-/);
  });

  it('truncates a long name in its button, the card passing presses on its rim through', () => {
    render(
      <PageLabelCard
        label="A very long page name"
        name="A very long page name"
        rest=""
        onClick={() => {}}
      />,
    );
    expect(card().className).toMatch(/pointer-events-none/);
    const button = screen.getByRole('button');
    expect(button.className).toMatch(/truncate/);
    expect(button.className).toMatch(/pointer-events-auto/);
    expect(button.getAttribute('data-tour-id')).toBe('page-name');
  });

  it('describes the press in its hover card', () => {
    render(<PageLabelCard label="Title" name="Title" rest="" onClick={() => {}} />);
    expect(
      screen.getByRole('button', { description: 'Press to fit this page to the screen.' }),
    ).toBeTruthy();
  });

  it('calls its press once, a double press staying its own, and shows no grab cursor', () => {
    const onClick = vi.fn();
    const onDoubleClickAbove = vi.fn();
    render(
      <div onDoubleClick={onDoubleClickAbove}>
        <PageLabelCard label="Title" name="Title" rest="" onClick={onClick} />
      </div>,
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.doubleClick(button);
    expect(onClick).toHaveBeenCalledOnce();
    expect(onDoubleClickAbove).not.toHaveBeenCalled();
    expect(button.className).not.toMatch(/cursor-grab/);
  });
});
