// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { IconButton, tileHint } from './PaletteIconButton';

afterEach(cleanup);

const noop = () => {};

// Hover a tile and report which hint answered: a Tooltip opens only after
// its delay, a hover card at once, so an immediate hover card is telling.
function hintOn(button: HTMLElement): string | null {
  fireEvent.pointerEnter(button, { pointerType: 'mouse' });
  return screen.queryByRole('tooltip')?.dataset.hint ?? null;
}

describe('tileHint', () => {
  it('gives a captioned tile a Tooltip and a caption-less one a hover card', () => {
    expect(tileHint(undefined, false)).toBe('tooltip');
    expect(tileHint(undefined, true)).toBe('hover-card');
  });

  it('lets the caller choose', () => {
    expect(tileHint('tooltip', true)).toBe('tooltip');
    expect(tileHint('hover-card', false)).toBe('hover-card');
  });
});

describe('IconButton hint', () => {
  it('wraps a captioned tile in a layout-neutral Tooltip, not a hover card', () => {
    render(
      <IconButton label="Add square" description="Drop a square." onClick={noop}>
        <svg />
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Add square' });
    expect(button.parentElement?.className).toBe('contents');
    expect(hintOn(button)).toBeNull();
  });

  it('gives a caption-less tile a hover card with its description', () => {
    render(
      <IconButton label="Add square" description="Drop a square." onClick={noop} hideCaption>
        <svg />
      </IconButton>,
    );
    expect(hintOn(screen.getByRole('button'))).toBe('hover-card');
    expect(screen.getByRole('tooltip').textContent).toContain('Drop a square.');
  });

  it('gives an icon-picker glyph a Tooltip', () => {
    render(
      <IconButton
        label="Add Cloud"
        description="Drag it."
        onClick={noop}
        hideCaption
        hint="tooltip"
      >
        <svg />
      </IconButton>,
    );
    expect(screen.getByRole('button').parentElement?.className).toBe('contents');
  });

  it('carries no hint while disabled', () => {
    render(
      <IconButton label="Add square" description="Drop a square." onClick={noop} disabled>
        <svg />
      </IconButton>,
    );
    expect(screen.getByRole('button').parentElement?.className).not.toBe('contents');
  });
});
