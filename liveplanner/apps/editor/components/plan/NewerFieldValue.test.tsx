// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ITEM_TYPES, type CustomFieldDef, type Item, type ItemTypeDef } from '@liveplanner/items';
import { ItemFieldEditor, type ItemFieldContext } from './ItemFieldEditor';
import { NEWER_FIELD_LINE, NewerFieldValue } from './NewerFieldValue';
import { customFieldIcon, fieldIconOf, NEWER_FIELD_ICON } from './CustomFieldKindParts';
import { PlanCardFace } from './PlanCardFace';
import type { PlanPalette } from './plan-palette';

// docs/specs/026-plan/item-types.md "Fields from a newer version": a field a newer liveplanner made is read-only in the
// card panel, wears the Newer Field icon, and is never drawn on the card face.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('./PlanContext', () => ({ usePlan: () => null }));
afterEach(cleanup);

const PALETTE = {
  card: '#fff',
  cardBorder: '#ddd',
  text: '#111',
  muted: '#666',
  column: '#eee',
  focus: '#00f',
} as unknown as PlanPalette;
const SAM = { id: 'p-sam', name: 'Sam Lee', color: '#2563eb' };
const SIGNED = {
  id: 'f-signed',
  label: 'Signed By',
  kind: 'signature',
} as unknown as CustomFieldDef;
const FORECAST = {
  id: 'f-forecast',
  label: 'Forecast',
  kind: 'calculated',
  calculation: 'forecast',
} as unknown as CustomFieldDef;
const CONTRACT: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'contract',
  label: 'Contract',
  fields: ['title', 'status', 'f-signed', 'f-forecast'],
  custom: [SIGNED, FORECAST],
};
const make = (fields: Item['fields']): Item => ({
  id: 'item0001',
  type: 'contract',
  key: 1,
  rank: 'i',
  fields: { title: 'Lease', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: SAM,
  updatedBy: SAM,
});
const ctx = (item: Item): ItemFieldContext => ({
  item,
  type: CONTRACT,
  statuses: [],
  people: [SAM],
  canEdit: true,
  labels: [],
  onSave: vi.fn(),
  onPatch: vi.fn(),
  onOpenItem: vi.fn(),
});

describe('a newer field in the card panel', () => {
  it('shows a plain value read-only, with why it cannot be edited', () => {
    const { container } = render(
      <ItemFieldEditor f="f-signed" ctx={ctx(make({ 'f-signed': 'Priya Shah' }))} />,
    );
    expect(screen.getByText('Priya Shah')).toBeTruthy();
    expect(screen.getByText(NEWER_FIELD_LINE)).toBeTruthy();
    expect(container.querySelector('output#item-item0001-f-signed')).toBeTruthy();
    expect(container.querySelector('input, textarea, button, select')).toBeNull();
  });

  it('draws a newer calculation the same way, never working it out', () => {
    render(<ItemFieldEditor f="f-forecast" ctx={ctx(make({}))} />);
    expect(screen.getByText(NEWER_FIELD_LINE)).toBeTruthy();
  });

  it('reads one word, number or line of text, and leaves out anything else', () => {
    const shown = (value: Item['fields'][string] | undefined) => {
      const { container } = render(<NewerFieldValue id="v" value={value} />);
      const text = container.querySelector('output')!.textContent.replace(NEWER_FIELD_LINE, '');
      cleanup();
      return text;
    };
    expect(shown(1250.5)).toBe((1250.5).toLocaleString());
    expect(shown(true)).toBe('Yes');
    expect(shown(false)).toBe('No');
    expect(shown('  ')).toBe('');
    expect(shown(Number.NaN)).toBe('');
    expect(shown({ start: '2026-11-01', end: '2026-11-03' })).toBe('');
    expect(shown(undefined)).toBe('');
  });
});

describe('a newer field’s icon', () => {
  it('is the Newer Field icon wherever a kind’s icon would be', () => {
    expect(fieldIconOf('f-signed', SIGNED)).toBe(NEWER_FIELD_ICON);
    expect(fieldIconOf('f-forecast', FORECAST).name).toBe('Newer Field');
    expect(fieldIconOf('f-n', { kind: 'number' }).name).not.toBe('Newer Field');
    expect(customFieldIcon(SIGNED)).toBe(NEWER_FIELD_ICON.node);
    expect(customFieldIcon({ kind: 'number' })).not.toBe(NEWER_FIELD_ICON.node);
  });
});

describe('a newer field on the card face', () => {
  it('is never drawn, whatever its value, beside a known field that is', () => {
    const type = {
      ...CONTRACT,
      fields: [...CONTRACT.fields, 'f-amount'],
      custom: [...CONTRACT.custom!, { id: 'f-amount', label: 'Amount', kind: 'number' }],
      display: { detailed: { body: ['f-signed', 'f-amount'] } },
    } as ItemTypeDef;
    const { container } = render(
      <PlanCardFace
        item={make({ 'f-signed': 'Priya Shah', 'f-amount': 12 })}
        palette={PALETTE}
        typeOverride={type}
        fields={[]}
        size="detailed"
      />,
    );
    expect(container.textContent).toContain('12');
    expect(container.textContent).not.toContain('Priya Shah');
  });
});
