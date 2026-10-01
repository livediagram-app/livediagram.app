// @vitest-environment jsdom

// The agenda (docs/specs/012-collaboration/agenda.md) and decision record
// (docs/specs/012-collaboration/decision-record.md) row editors: drafts committed on blur that follow
// the element's rows when they change.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgendaItem, ShapeElement } from '@livediagram/document';
import { AgendaMenuSection, DecisionMenuSection } from './CollabMenuSections';

const shape = (over: Partial<ShapeElement>): ShapeElement =>
  ({ id: 's1', type: 'rectangle', ...over }) as ShapeElement;
const sectionProps = () => ({ open: true, onToggle: vi.fn() });

afterEach(() => cleanup());

describe('AgendaMenuSection', () => {
  const agenda = (items?: AgendaItem[]) => (
    <AgendaMenuSection
      target={shape({ agendaItems: items })}
      sectionProps={sectionProps}
      onSetItems={vi.fn()}
    />
  );
  const name = (i: number) => screen.getByLabelText(`Segment ${i} name`) as HTMLInputElement;

  // Same loop as the decision drivers below: a fresh `?? []` per render, set by an effect.
  it('settles for an element without segments', () => {
    const { rerender } = render(agenda());
    rerender(agenda());
    expect(screen.queryByLabelText('Segment 1 name')).toBeNull();
  });

  it('keeps a typed draft through a re-render with the same segments', () => {
    const items = [{ label: 'Intro', minutes: 5 }];
    const { rerender } = render(agenda(items));
    fireEvent.change(name(1), { target: { value: 'Welcome' } });
    rerender(agenda(items));
    expect(name(1).value).toBe('Welcome');
  });

  it('follows the element when its segments change', () => {
    const { rerender } = render(agenda([{ label: 'Intro', minutes: 5 }]));
    fireEvent.change(name(1), { target: { value: 'Welcome' } });
    rerender(agenda([{ label: 'Kick-off', minutes: 5 }]));
    expect(name(1).value).toBe('Kick-off');
  });
});

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
  const driver = (i: number) => screen.getByLabelText(`Driver ${i}`) as HTMLInputElement;

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
