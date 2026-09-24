// @vitest-environment jsdom

// The web components' menu row editors (spec/147): add / remove / reorder,
// bounded by each kind's minimum and maximum.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createShape,
  NAV_LINKS_MAX,
  PROCESS_MIN_STEPS,
  STATS_MIN,
  type WebRows,
} from '@livediagram/diagram';

import { hasWebRowsSection, WebRowsMenuSection } from './context-menu-web-editors';

afterEach(cleanup);

const open = () => ({ open: true, onToggle: () => {}, flush: true });

function renderSection(shape: Parameters<typeof createShape>[0], patch: object = {}) {
  const onSetRows = vi.fn<(rows: WebRows) => void>();
  render(
    <WebRowsMenuSection
      target={{ ...createShape(shape, 0, 0), ...patch }}
      sectionProps={open}
      onSetRows={onSetRows}
    />,
  );
  return onSetRows;
}

describe('WebRowsMenuSection (spec/147)', () => {
  it('only the row-carrying kinds get a section', () => {
    expect(hasWebRowsSection(createShape('stat-row', 0, 0))).toBe(true);
    expect(hasWebRowsSection(createShape('process', 0, 0))).toBe(true);
    expect(hasWebRowsSection(createShape('site-header', 0, 0))).toBe(true);
    expect(hasWebRowsSection(createShape('banner', 0, 0))).toBe(false);
    expect(hasWebRowsSection(createShape('square', 0, 0))).toBe(false);
  });

  it('adds a step and removes one', () => {
    const onSetRows = renderSection('process');
    fireEvent.click(screen.getByRole('button', { name: 'Add Step' }));
    expect(onSetRows).toHaveBeenLastCalledWith({
      processSteps: ['Plan', 'Build', 'Ship', 'Step 4'],
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove step' })[0]!);
    expect(onSetRows).toHaveBeenLastCalledWith({ processSteps: ['Build', 'Ship'] });
  });

  it('reorders a link, and disables moves past either end', () => {
    const onSetRows = renderSection('site-header');
    fireEvent.click(screen.getAllByRole('button', { name: 'Move link down' })[0]!);
    expect(onSetRows).toHaveBeenLastCalledWith({ navLinks: ['About', 'Home', 'Contact'] });
    expect(
      (screen.getAllByRole('button', { name: 'Move link up' })[0] as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('will not remove below the minimum or add above the maximum', () => {
    renderSection('process', { processSteps: Array(PROCESS_MIN_STEPS).fill('s') });
    for (const b of screen.getAllByRole('button', { name: 'Remove step' })) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
    cleanup();
    renderSection('stat-row', { stats: [{ value: '1', caption: 'a' }].slice(0, STATS_MIN) });
    expect(
      (screen.getByRole('button', { name: 'Remove stat' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    cleanup();
    renderSection('site-header', { navLinks: Array(NAV_LINKS_MAX).fill('l') });
    expect((screen.getByRole('button', { name: 'Add Link' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('commits a retyped stat on blur', () => {
    const onSetRows = renderSection('stat-row');
    const input = screen.getByRole('textbox', { name: 'Stat 1 caption' });
    fireEvent.change(input, { target: { value: 'Customers' } });
    fireEvent.blur(input);
    expect(onSetRows).toHaveBeenLastCalledWith({
      stats: [
        { value: '1.2k', caption: 'Customers' },
        { value: '98%', caption: 'Uptime' },
        { value: '4.7', caption: 'Rating' },
      ],
    });
  });
});
