// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import { PercentSlider, shareAt, typedShare } from './PercentSlider';
import { PercentBar, PercentChip, PercentReading } from './PercentBar';
import { CalculatedFieldValue } from './CalculatedFieldValue';
import { CustomFieldEditor } from './CustomFieldEditor';
import { PlanCardFace } from './PlanCardFace';
import { planPalette } from './plan-palette';

// docs/specs/026-plan/item-types.md "Percent": the panel's draggable bar and number, the card face's chip, and a
// share shown as a Percent.
afterEach(cleanup);

const slider = () => screen.getByRole('slider', { name: 'Progress' });
const box = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Progress, percent' });

function panel(value: unknown, disabled = false) {
  const onSave = vi.fn();
  render(
    <PercentSlider id="f" label="Progress" value={value} disabled={disabled} onSave={onSave} />,
  );
  return onSave;
}

// The track's box, as the browser would lay it out: 200 px wide from x = 100.
function layTrack() {
  const track = slider().firstElementChild as HTMLElement;
  track.getBoundingClientRect = () => ({ left: 100, width: 200 }) as DOMRect;
  slider().setPointerCapture = () => {};
}

describe('shareAt and typedShare', () => {
  it('read the share under the pointer, held to 0 to 100', () => {
    expect(shareAt(150, { left: 100, width: 200 })).toBe(25);
    expect(shareAt(40, { left: 100, width: 200 })).toBe(0);
    expect(shareAt(900, { left: 100, width: 200 })).toBe(100);
    expect(shareAt(150, { left: 100, width: 0 })).toBe(0);
  });

  it('read typed text: empty clears, a number is held, anything else puts the box back', () => {
    expect(typedShare(' ')).toBeUndefined();
    expect(typedShare('40%')).toBe(40);
    expect(typedShare('150')).toBe(100);
    expect(typedShare('-5')).toBe(0);
    expect(typedShare('lots')).toBeNull();
  });
});

describe('PercentSlider', () => {
  it('is a slider named by its field, its value spoken as a percent', () => {
    panel(40);
    expect(slider().getAttribute('aria-valuenow')).toBe('40');
    expect(slider().getAttribute('aria-valuetext')).toBe('40%');
    expect(slider().getAttribute('aria-valuemin')).toBe('0');
    expect(slider().getAttribute('aria-valuemax')).toBe('100');
    expect(box().value).toBe('40');
  });

  it('steps with the keys, one change a press, held to 0 to 100', () => {
    const onSave = panel(40);
    const keys: [string, number][] = [
      ['ArrowRight', 41],
      ['ArrowUp', 41],
      ['ArrowLeft', 39],
      ['ArrowDown', 39],
      ['PageUp', 50],
      ['PageDown', 30],
      ['Home', 0],
      ['End', 100],
    ];
    for (const [key, want] of keys) {
      onSave.mockClear();
      fireEvent.keyDown(slider(), { key });
      expect(onSave, key).toHaveBeenCalledWith(want);
    }
    onSave.mockClear();
    fireEvent.keyDown(slider(), { key: 'a' });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('never saves a step that changes nothing', () => {
    const onSave = panel(100);
    fireEvent.keyDown(slider(), { key: 'End' });
    fireEvent.keyDown(slider(), { key: 'ArrowRight' });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('draws a drag live and saves it once, on release', () => {
    const onSave = panel(10);
    layTrack();
    fireEvent.pointerDown(slider(), { button: 0, clientX: 150, pointerId: 1 });
    expect(slider().getAttribute('aria-valuenow')).toBe('25');
    fireEvent.pointerMove(slider(), { clientX: 200, pointerId: 1 });
    expect(slider().getAttribute('aria-valuenow')).toBe('50');
    expect(box().value).toBe('50');
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider(), { clientX: 260, pointerId: 1 });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(80);
  });

  it('ignores a move with no press, a right press, and puts a cancelled drag back', () => {
    const onSave = panel(10);
    layTrack();
    fireEvent.pointerMove(slider(), { clientX: 200 });
    fireEvent.pointerUp(slider(), { clientX: 200 });
    fireEvent.pointerDown(slider(), { button: 2, clientX: 200 });
    expect(slider().getAttribute('aria-valuenow')).toBe('10');
    fireEvent.pointerDown(slider(), { button: 0, clientX: 200, pointerId: 1 });
    fireEvent.pointerCancel(slider(), { pointerId: 1 });
    expect(slider().getAttribute('aria-valuenow')).toBe('10');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves a typed share on Enter or leaving, held to 0 to 100; empty clears; Escape puts it back', () => {
    const onSave = panel(40);
    fireEvent.change(box(), { target: { value: '150' } });
    fireEvent.keyDown(box(), { key: 'Enter' });
    fireEvent.blur(box());
    expect(onSave).toHaveBeenLastCalledWith(100);
    cleanup();
    const cleared = panel(40);
    fireEvent.change(box(), { target: { value: '' } });
    fireEvent.blur(box());
    expect(cleared).toHaveBeenCalledWith(undefined);
    cleanup();
    const escaped = panel(40);
    fireEvent.change(box(), { target: { value: '7' } });
    fireEvent.keyDown(box(), { key: 'Escape' });
    fireEvent.blur(box());
    expect(box().value).toBe('40');
    expect(escaped).not.toHaveBeenCalled();
  });

  it('puts back text that is no number, and saves nothing unchanged', () => {
    const onSave = panel(40);
    fireEvent.change(box(), { target: { value: 'lots' } });
    fireEvent.blur(box());
    expect(box().value).toBe('40');
    fireEvent.change(box(), { target: { value: '40' } });
    fireEvent.blur(box());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('with no value: an empty track, a faded thumb at 0, a blank box; clearing nothing saves nothing', () => {
    const onSave = panel(undefined);
    expect(slider().getAttribute('aria-valuetext')).toBe('No value');
    expect(slider().getAttribute('aria-valuenow')).toBe('0');
    expect(box().value).toBe('');
    fireEvent.blur(box());
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(box(), { target: { value: 'x' } });
    fireEvent.blur(box());
    expect(box().value).toBe('');
    fireEvent.keyDown(box(), { key: 'Escape' });
    expect(box().value).toBe('');
    fireEvent.keyDown(slider(), { key: 'ArrowRight' });
    expect(onSave).toHaveBeenCalledWith(1);
  });

  it('shows a Viewer the bar and the number, with nothing to drag or type', () => {
    panel(140, true);
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('100%')).toBeTruthy();
    cleanup();
    panel(undefined, true);
    expect(screen.getByText('None')).toBeTruthy();
  });

  it('is the panel control CustomFieldEditor draws for a Percent field', () => {
    const onSave = vi.fn();
    render(
      <CustomFieldEditor
        id="f"
        field={{ id: 'f-progress', label: 'Progress', kind: 'percent' }}
        value={30}
        disabled={false}
        onSave={onSave}
      />,
    );
    fireEvent.keyDown(slider(), { key: 'ArrowUp' });
    expect(onSave).toHaveBeenCalledWith(31);
  });
});

describe('PercentBar, PercentChip and PercentReading', () => {
  it('fill the share, nothing at 0', () => {
    const { container, rerender } = render(<PercentBar value={40} />);
    expect((container.querySelector('.bg-brand-600') as HTMLElement).style.width).toBe('40%');
    rerender(<PercentBar value={0} />);
    expect(container.querySelector('.bg-brand-600')).toBeNull();
    rerender(<PercentBar value={undefined} inks={{ fill: '#ff0000', track: '#00ff00' }} />);
    expect((container.firstElementChild as HTMLElement).style.backgroundColor).toBe(
      'rgb(0, 255, 0)',
    );
  });

  it('name the chip for assistive technology, in the palette’s inks', () => {
    render(<PercentChip name="Progress" value={25} palette={planPalette('light')} />);
    expect(screen.getByText('Progress: 25%')).toBeTruthy();
  });

  it('read the share after the bar in the panel', () => {
    const { container } = render(<PercentReading id="r" value={70} />);
    expect(container.querySelector('output#r')?.textContent).toBe('70%');
  });
});

describe('a share shown as a Percent', () => {
  const done = {
    label: 'Done',
    kind: 'calculated' as const,
    calculation: 'childrenDone' as const,
  };

  it('draws the Percent bar in the panel when it says so, else the text and thin bar as before', () => {
    const { container, rerender } = render(
      <CalculatedFieldValue
        id="v"
        field={{ ...done, showAs: 'percent' }}
        outcome={{ ok: true, value: 40 }}
      />,
    );
    expect(container.querySelector('#v output')?.textContent).toBe('40%');
    expect((container.querySelector('.bg-brand-600') as HTMLElement).style.width).toBe('40%');
    rerender(
      <CalculatedFieldValue
        id="v"
        field={{ ...done, showAs: 'percent' }}
        outcome={{ ok: true, value: null }}
      />,
    );
    expect(screen.getByText('No linked cards')).toBeTruthy();
    rerender(<CalculatedFieldValue id="v" field={done} outcome={{ ok: true, value: 40 }} />);
    expect(container.querySelector('.bg-brand-600')).toBeNull();
    expect(container.querySelector('.bg-brand-500')).toBeTruthy();
  });
});

describe('the card face', () => {
  const by = { id: 'p', name: 'Sam', color: '#2563eb' };
  const work: ItemTypeDef = {
    ...ITEM_TYPES[1],
    id: 'work',
    label: 'Work',
    fields: ['title', 'status', 'f-progress', 'f-done'],
    custom: [
      { id: 'f-progress', label: 'Progress', kind: 'percent' },
      {
        id: 'f-done',
        label: 'Done',
        kind: 'calculated',
        calculation: 'childrenDone',
        showAs: 'percent',
      },
    ],
    display: { detailed: { body: ['f-progress', 'f-done'] } },
  };
  const card = (fields: Item['fields']): Item => ({
    id: 'w',
    type: 'work',
    key: 1,
    rank: 'i',
    fields: { title: 'Launch', ...fields },
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: by,
    updatedBy: by,
  });
  const face = (fields: Item['fields']) =>
    render(
      <PlanCardFace
        item={card(fields)}
        palette={planPalette('light')}
        fields={[]}
        typeOverride={work}
      />,
    );

  it('draws a Percent as its chip, a stray value held to 100%, and nothing without a value', () => {
    face({ 'f-progress': 60 });
    expect(screen.getByText('Progress: 60%')).toBeTruthy();
    cleanup();
    face({ 'f-progress': 140 });
    expect(screen.getByText('Progress: 100%')).toBeTruthy();
    cleanup();
    face({});
    expect(screen.queryByText(/^Progress/)).toBeNull();
    // A share worked out from the plan needs the plan: without one it draws nothing, never a wrong share.
    expect(screen.queryByText(/^Done/)).toBeNull();
  });
});
