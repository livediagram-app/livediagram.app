// @vitest-environment jsdom

// The Avatar Pad menu's Receptionist switch (docs/specs/008-canvas/receptionist.md "Asking him to leave").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { ReceptionistMenuSection } from './ReceptionistMenuSection';

afterEach(cleanup);

const pad = (left?: boolean) =>
  ({
    ...createShape('avatar-pad', 0, 0),
    ...(left ? { receptionistLeft: true } : {}),
  }) as ShapeElement;
const open = () => ({ open: true, onToggle: () => {} });

describe('ReceptionistMenuSection', () => {
  it('is on while he is there, and switching it off asks him to leave', () => {
    const onSetHere = vi.fn();
    render(<ReceptionistMenuSection target={pad()} sectionProps={open} onSetHere={onSetHere} />);
    const row = screen.getByRole('button', { pressed: true });
    expect(row.textContent).toMatch(/Greets everyone who arrives/);
    fireEvent.click(row);
    expect(onSetHere).toHaveBeenCalledWith(false);
  });

  it('is off once he was asked to leave, and switching it on brings him back', () => {
    const onSetHere = vi.fn();
    render(
      <ReceptionistMenuSection target={pad(true)} sectionProps={open} onSetHere={onSetHere} />,
    );
    fireEvent.click(screen.getByRole('button', { pressed: false }));
    expect(onSetHere).toHaveBeenCalledWith(true);
  });
});
