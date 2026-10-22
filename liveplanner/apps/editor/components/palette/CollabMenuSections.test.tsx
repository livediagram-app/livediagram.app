// @vitest-environment jsdom

// The decision record (docs/specs/012-collaboration/decision-record.md) row editor: drafts committed on blur
// that follow the element's rows when they change.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShapeElement } from '@liveplanner/project';
import { DecisionMenuSection } from './CollabMenuSections';

const shape = (over: Partial<ShapeElement>): ShapeElement =>
  ({ id: 's1', type: 'rectangle', ...over }) as ShapeElement;
const sectionProps = () => ({ open: true, onToggle: vi.fn() });

afterEach(() => cleanup());

describe('DecisionMenuSection', () => {
  const decision = (drivers?: string[]) => (
    <DecisionMenuSection
      target={shape({ decisionDrivers: drivers })}
      sectionProps={sectionProps}
      onSetStatus={vi.fn()}
      onSetDate={vi.fn()}
      onSetDrivers={vi.fn()}
    />
  );
  const driver = (i: number) => screen.getByLabelText<HTMLInputElement>(`Driver ${i}`);

  // An element without drivers once re-rendered forever: `?? []` minted a new array per render and
  // the follow effect set it, which rendered again.
  it('settles for an element without drivers', () => {
    const { rerender } = render(decision());
    rerender(decision());
    expect(screen.queryByLabelText('Driver 1')).toBeNull();
  });

  it('keeps a typed draft through a re-render with the same drivers', () => {
    const drivers = ['Cost'];
    const { rerender } = render(decision(drivers));
    fireEvent.change(driver(1), { target: { value: 'Speed' } });
    rerender(decision(drivers));
    expect(driver(1).value).toBe('Speed');
  });

  it('follows the element when its drivers change', () => {
    const { rerender } = render(decision(['Cost']));
    rerender(decision(['Risk']));
    expect(driver(1).value).toBe('Risk');
  });
});
