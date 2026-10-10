// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { penColourHex } from '@livediagram/document';
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
    people: [],
    canEdit: true,
    labels: [],
    onSave: vi.fn(),
    onPatch: vi.fn(),
    onOpenItem: vi.fn(),
    ...over,
  };
}

// docs/specs/026-plan/items.md "Colour", on the one colour picker's field skin
// (docs/specs/004-interface-design/colour-picker.md "Skins").
const nextFrame = () => act(() => new Promise((r) => requestAnimationFrame(() => r(null))));
const VIOLET = penColourHex('violet', 'light');

describe('the item panel Colour field', () => {
  it('is one field naming the colour, opening the picker; a pick sets it, None clears it', () => {
    const c = ctx(make({ title: 'P', color: VIOLET }));
    render(<ItemFieldEditor f="color" ctx={c} />);
    const trigger = screen.getByRole('button', { name: 'Colour: Violet' });
    // Closed, the swatches take no room.
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Violet' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
    // A pick closes it, focus back on the field.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(vi.mocked(c.onSave).mock.calls).toEqual([
      ['color', penColourHex('blue', 'light')],
      ['color', undefined],
    ]);
  });

  it('names an earlier Plan colour by its word', () => {
    render(<ItemFieldEditor f="color" ctx={ctx(make({ title: 'P', color: '#2563eb' }))} />);
    expect(screen.getByRole('button', { name: 'Colour: Blue' })).toBeTruthy();
  });

  it('opens with an arrow on the picked swatch; Escape closes it only and returns to the field', async () => {
    const c = ctx(make({ title: 'P', color: VIOLET }));
    // The card panel's own Escape, on the document: it must not hear the popover's Escape.
    const panelEscape = vi.fn((e: KeyboardEvent) => e.key === 'Escape');
    const panelEscapes = () => panelEscape.mock.results.filter((r) => r.value).length;
    document.addEventListener('keydown', panelEscape);
    render(<ItemFieldEditor f="color" ctx={c} />);
    const trigger = screen.getByRole('button', { name: 'Colour: Violet' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    await nextFrame();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Violet' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'None' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(panelEscapes()).toBe(0);
    document.removeEventListener('keydown', panelEscape);
  });

  it('opens on None when there is no colour', async () => {
    render(<ItemFieldEditor f="color" ctx={ctx(make({ title: 'P' }))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Colour: None' }));
    await nextFrame();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'None' }));
  });

  it('closes on a press outside, saving nothing', () => {
    const c = ctx(make({ title: 'P', color: VIOLET }));
    render(
      <>
        <ItemFieldEditor f="color" ctx={c} />
        <button type="button">Elsewhere</button>
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Colour: Violet' }));
    fireEvent.pointerDown(screen.getByRole('dialog', { name: 'Colour' }));
    expect(screen.getByRole('dialog', { name: 'Colour' })).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(c.onSave).not.toHaveBeenCalled();
  });
});
