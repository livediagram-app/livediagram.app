// @vitest-environment jsdom

// liveplanner's Picker face (docs/specs/012-collaboration/picker.md): the shared reel with this editor's
// avatars. The reel's own behaviour is pinned by the shared face's tests (@liveworkspace/workbench PickerFace).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@liveplanner/project';

import type { Participant } from '@/lib/identity';
import { PickerFace } from './PickerFace';

afterEach(cleanup);

const picker = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('picker', 0, 0),
  id: 'pick-1',
  ...over,
});
const me = { id: 'me', name: 'Ada Lovelace', color: '#0ea5e9', status: 'online' } as Participant;

describe('liveplanner PickerFace', () => {
  it('draws a person on the payline with their avatar', () => {
    render(
      <PickerFace
        element={picker({ pickerResult: 'Ada Lovelace' })}
        label="Who goes first?"
        textColor="#0f172a"
        picker={{ candidates: [{ label: 'Ada Lovelace', participant: me }], shared: true }}
      />,
    );
    expect(screen.getAllByText('AL').length).toBeGreaterThan(0);
  });

  it('hands Reset to the reel during a Remove Once Drawn round', () => {
    const reset = vi.fn();
    render(
      <PickerFace
        element={picker({ pickerRemoveDrawn: true, pickerDrawn: ['A'], pickerResult: 'A' })}
        label=""
        textColor="#0f172a"
        picker={{
          candidates: [{ label: 'A' }, { label: 'B' }],
          shared: true,
          roll: () => null,
          reset,
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset the draw' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('renders inert with no session behind the canvas', () => {
    render(<PickerFace element={picker()} label="Who goes first?" textColor="#0f172a" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps clear of the corner menu, and replays the same name pressed again', () => {
    const face = (pickerRolledAt: number) => (
      <PickerFace
        element={picker({ pickerResult: 'A', pickerRolledAt })}
        label="Who demos?"
        textColor="#0f172a"
        picker={{ candidates: [{ label: 'A' }, { label: 'B' }], shared: true }}
        cornerMenu
      />
    );
    const view = render(face(1));
    expect(screen.getByText('Who demos?').parentElement!.className).toContain('pr-7');
    view.rerender(face(2));
    expect(document.querySelector('[data-picker-state]')!.getAttribute('data-picker-state')).toBe(
      'spinning',
    );
  });
});
