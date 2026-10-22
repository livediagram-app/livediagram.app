// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLEND_MODE_GROUPS, BLEND_MODE_NAMES } from '@livedesign/photo-engine';
import { choiceSections } from '@/lib/photo-editor/option-guides';
import { OptionChoicePopover } from './OptionPopover';
import { fromLogPosition, logScaled, toLogPosition } from './slider-scale';

// docs/specs/031-photo/photo-pages.md "The options flyout": each option a button showing its value, its control in a
// popover in the palette flyout's look: a header saying what it does, the control, a footer.
afterEach(cleanup);

const STYLES = [
  { value: 'linear', label: 'Linear' },
  { value: 'radial', label: 'Radial' },
  { value: 'diamond', label: 'Diamond' },
] as const;

const MODES = [
  { value: 'new', label: 'New' },
  { value: 'add', label: 'Add' },
  { value: 'subtract', label: 'Subtract' },
  { value: 'intersect', label: 'Intersect' },
] as const;

describe('an option with a choice', () => {
  it('shows its value, opens its tiles under a header, and picks one and closes', () => {
    const onChange = vi.fn();
    render(
      <OptionChoicePopover
        label="Style"
        guide="gradientStyle"
        value="linear"
        choices={STYLES}
        onChange={onChange}
      />,
    );
    const button = screen.getByRole('button', { name: 'Style: Linear' });
    expect(screen.queryByRole('listbox', { name: 'Style' })).toBeNull();
    fireEvent.click(button);
    expect(screen.getByRole('heading', { name: 'Style' })).toBeTruthy();
    expect(screen.getByText('The shape the colours spread out in.')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Linear' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('option', { name: 'Diamond' }));
    expect(onChange).toHaveBeenCalledWith('diamond');
    expect(screen.queryByRole('listbox', { name: 'Style' })).toBeNull();
  });

  it('says what each choice does and its key, and the footer follows the pointer', () => {
    render(
      <OptionChoicePopover
        label="Selection"
        guide="selection"
        value="new"
        choices={MODES}
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Selection: New' }));
    const add = screen.getByRole('option', { name: 'Add' });
    expect(within(add).getByText('Adds to the selection.')).toBeTruthy();
    expect(within(add).getByText('Shift')).toBeTruthy();
    const footer = document.querySelector('[data-flyout-footer]')!;
    // The chosen one, until another is pointed at.
    expect(footer.textContent).toContain('Replaces the selection.');
    fireEvent.pointerEnter(screen.getByRole('option', { name: 'Intersect' }));
    expect(footer.textContent).toContain('Keeps only where the two overlap.');
  });

  it('lays a long list out in two columns', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ value: i, label: `Mode ${i}` }));
    render(<OptionChoicePopover label="Thing" value={3} choices={many} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Thing: Mode 3' }));
    const grid = screen
      .getByRole('listbox', { name: 'Thing' })
      .querySelector('.grid') as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
  });

  it("shows the blend modes in their families, a brush's own last", () => {
    const blends = [
      ...BLEND_MODE_GROUPS.flat().map((m) => ({ value: m as string, label: BLEND_MODE_NAMES[m] })),
      { value: 'behind', label: 'Behind' },
      { value: 'clear', label: 'Clear' },
    ];
    const sections = choiceSections('mode', blends);
    expect(sections.map((s) => s.title)).toEqual([
      'Normal',
      'Darken',
      'Lighten',
      'Contrast',
      'Inversion',
      'Component',
      'Painting',
    ]);
    expect(sections.flatMap((s) => s.choices)).toHaveLength(blends.length);
    render(
      <OptionChoicePopover label="Mode" value="multiply" choices={blends} onChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mode: Multiply' }));
    expect(screen.getByRole('region', { name: 'Darken' })).toBeTruthy();
  });
});

describe('a number option', () => {
  it('runs a wide range on a log scale, so the small sizes get room', () => {
    expect(logScaled(1, 2500)).toBe(true);
    expect(logScaled(0, 1)).toBe(false);
    expect(fromLogPosition(0, 1, 2500, 1)).toBe(1);
    expect(fromLogPosition(1000, 1, 2500, 1)).toBe(2500);
    // Half way along is 50 px, not 1250.
    expect(fromLogPosition(500, 1, 2500, 1)).toBe(50);
    expect(Math.round(toLogPosition(50, 1, 2500))).toBe(500);
  });
});
