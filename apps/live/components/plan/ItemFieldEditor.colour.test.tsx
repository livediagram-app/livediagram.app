// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import { ItemFieldEditor, type ItemFieldContext } from './ItemFieldEditor';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(cleanup);

const project = ITEM_TYPES.find((t) => t.id === 'project')!;
const PERSON = { id: 'p1', name: 'Ali', color: '#2563eb' };
const make = (fields: Item['fields'], id = 'item0001'): Item => ({
  id,
  type: 'project',
  key: 1,
  rank: 'i',
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

function ctx(item: Item, over: Partial<ItemFieldContext> = {}): ItemFieldContext {
  return {
    item,
    type: project,
    statuses: [],
    projects: [],
    people: [],
    canEdit: true,
    labels: [],
    onSave: vi.fn(),
    onPatch: vi.fn(),
    onOpenItem: vi.fn(),
    ...over,
  };
}

// docs/specs/026-plan/items.md "Colour".
describe('the item panel Colour field', () => {
  it('is one dropdown naming the colour, opening the swatches; a pick sets it, None clears it', () => {
    const c = ctx(make({ title: 'P', color: '#2563eb' }));
    render(<ItemFieldEditor f="color" ctx={c} />);
    const trigger = screen.getByRole('button', { name: 'Colour: Blue' });
    // Closed, the swatches take no room.
    expect(screen.queryByRole('radio')).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByRole('radio', { name: 'Blue' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Violet' }));
    // A pick closes it.
    expect(screen.queryByRole('radio')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('radio')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('radio', { name: 'None' }));
    expect(vi.mocked(c.onSave).mock.calls).toEqual([
      ['color', '#7c3aed'],
      ['color', undefined],
    ]);
  });

  it('draws the swatches inside the field, so the card panel dialog (and its focus trap) holds them', () => {
    const c = ctx(make({ title: 'P', color: '#2563eb' }));
    render(
      <div role="dialog" aria-modal="true">
        <ItemFieldEditor f="color" ctx={c} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Colour: Blue' }));
    const panel = screen.getByRole('dialog', { name: '' });
    const pop = screen.getByRole('dialog', { name: 'Colour' });
    expect(panel.contains(pop)).toBe(true);
    expect(panel.contains(screen.getByRole('radio', { name: 'Blue' }))).toBe(true);
  });

  it('takes the keyboard: focus on the picked swatch, the arrows move, a press picks, Escape returns to the trigger', () => {
    const c = ctx(make({ title: 'P', color: '#2563eb' }));
    // The card panel's own Escape, on the document: it must not hear the popover's Escape.
    const panelEscape = vi.fn((e: KeyboardEvent) => e.key === 'Escape');
    const panelEscapes = () => panelEscape.mock.results.filter((r) => r.value).length;
    document.addEventListener('keydown', panelEscape);
    render(<ItemFieldEditor f="color" ctx={c} />);
    const trigger = screen.getByRole('button', { name: 'Colour: Blue' });
    trigger.focus();
    // ArrowDown on the trigger opens it, focus on the picked swatch, the group's one Tab stop.
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const blue = screen.getByRole('radio', { name: 'Blue' });
    expect(document.activeElement).toBe(blue);
    expect(screen.getAllByRole('radio').filter((r) => r.tabIndex === 0)).toEqual([blue]);
    fireEvent.keyDown(blue, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Yellow' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'None' }));
    // Wrapping back from None to the last swatch.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Cyan' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('radio')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(panelEscapes()).toBe(0);
    // Enter or Space on a swatch is the button's own click: it picks, closes, and focus returns to the trigger.
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Blue' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    fireEvent.click(document.activeElement!);
    expect(c.onSave).toHaveBeenCalledWith('color', '#eab308');
    expect(screen.queryByRole('radio')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    document.removeEventListener('keydown', panelEscape);
  });

  it('opens on None when there is no colour', () => {
    render(<ItemFieldEditor f="color" ctx={ctx(make({ title: 'P' }))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Colour: None' }));
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'None' }));
  });

  it('closes on a press outside, or when focus leaves it', () => {
    const c = ctx(make({ title: 'P', color: '#2563eb' }));
    render(
      <>
        <ItemFieldEditor f="color" ctx={c} />
        <button type="button">Elsewhere</button>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Colour: Blue' });
    fireEvent.click(trigger);
    // A press inside the popover keeps it.
    fireEvent.pointerDown(screen.getByRole('dialog', { name: 'Colour' }));
    expect(screen.queryAllByRole('radio')).not.toHaveLength(0);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('radio')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.blur(screen.getByRole('radio', { name: 'Blue' }), {
      relatedTarget: screen.getByRole('button', { name: 'Elsewhere' }),
    });
    expect(screen.queryByRole('radio')).toBeNull();
    expect(c.onSave).not.toHaveBeenCalled();
  });

  it("shows a parent project's colour dot beside its picker", () => {
    const parent = make({ title: 'Launch', color: '#ea580c' }, 'item0002');
    const child = make({ title: 'Kid', parent: parent.id });
    render(<ItemFieldEditor f="parent" ctx={ctx(child, { projects: [parent] })} />);
    expect(screen.getByRole('img', { name: 'Orange colour' })).toBeTruthy();
  });
});
