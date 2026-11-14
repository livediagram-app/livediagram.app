// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemPatch, ItemTypeDef } from '@liveplanner/items';
import { ItemPanel } from './ItemPanel';
import { CardThreadsProvider } from './threads/CardThreadsContext';
import { contextOf, fakeThreads } from './threads/thread-test-kit';
import type { CardThreads as CardThreadsValue } from '@/hooks/plan/useCardThreads';

// The item panel's Hidden tab (docs/specs/026-plan/item-types.md "The Hidden tab", Work Tracker 857): last, with a
// count, only on a card keeping values its type doesn't show; grouped From {Type}, a removed field as plain text; an
// Editor's Copy To Field (only fields that can take it) and Remove, each one write; a Participant and a Viewer read it;
// it goes when the last value goes; opening it is tracked.

const env = vi.hoisted(() => ({ mobile: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => env.mobile,
}));
vi.mock('@/lib/api/item-history', () => ({ fetchItemHistory: () => Promise.resolve([]) }));
const track = vi.fn<(...args: unknown[]) => void>();
vi.mock('@/lib/telemetry', () => ({ track: (...args: unknown[]) => track(...args) }));

beforeEach(() => {
  env.mobile = false;
  track.mockReset();
});
afterEach(cleanup);

const type = (id: string, label: string, custom: ItemTypeDef['custom']): ItemTypeDef => ({
  id,
  label,
  newTitle: label,
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status', 'description', ...(custom ?? []).map((f) => f.id)],
  custom,
});
const IDEA = type('idea', 'Idea', [
  { id: 'f-solution', label: 'Solution', kind: 'longtext' },
  { id: 'f-size', label: 'Size', kind: 'number' },
]);
const WORK = type('work', 'Work Item', [
  { id: 'f-criteria', label: 'Acceptance Criteria', kind: 'longtext' },
]);
const TYPES = [IDEA, WORK];

const PERSON = { id: 'p', name: 'Sam', color: '#2563eb' };
const card = (fields: Item['fields'], t = 'work'): Item => ({
  id: 'item-one',
  type: t,
  key: 1,
  rank: 'i',
  fields: { title: 'A card', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});
const KEPT = { 'f-solution': 'Map by name', 'f-size': 3, 'f-gone': ['a', 'b'] };

function panel(item: Item, role: 'editor' | 'participant' | 'viewer' = 'editor') {
  const onPatch = vi.fn<(p: ItemPatch) => void>();
  const threads = {
    ...fakeThreads([]).threads,
    scope: { ownerId: 'o', projectId: 'plan-a', shareCode: null, tabId: null },
  } as unknown as CardThreadsValue;
  const ctx =
    role === 'editor'
      ? contextOf(threads)
      : contextOf(threads, { canComment: false, isEditor: false });
  const view = (it: Item) => (
    <CardThreadsProvider value={ctx}>
      <ItemPanel
        item={it}
        types={TYPES}
        statuses={[]}
        people={[]}
        labels={[]}
        canEdit={role !== 'viewer'}
        canRetire={role === 'editor'}
        onSave={vi.fn()}
        onPatch={onPatch}
        onType={vi.fn()}
        onOpenItem={vi.fn()}
        onTrash={vi.fn()}
        onDuplicate={vi.fn()}
        onFlag={vi.fn()}
        onArchive={vi.fn()}
        onClose={vi.fn()}
        trail={[it]}
        statusNames={new Map()}
      />
    </CardThreadsProvider>
  );
  const r = render(view(item));
  return { onPatch, rerender: (it: Item) => r.rerender(view(it)) };
}
const tabNames = () => screen.getAllByRole('tab').map((t) => t.textContent);

describe('the Hidden tab', () => {
  it('shows last, with its count, only on a card keeping hidden values', () => {
    panel(card({ 'f-criteria': 'Shown' }));
    expect(tabNames()).not.toContain('Hidden');
    cleanup();
    panel(card(KEPT));
    expect(tabNames().at(-1)).toBe('Hidden3');
    expect(screen.getByRole('tab', { name: 'Hidden, 3 values' })).toBeTruthy();
  });

  it('sits before the phone’s Details, which keeps the far right', () => {
    env.mobile = true;
    panel(card(KEPT));
    expect(tabNames().slice(-2)).toEqual(['Hidden3', 'Details']);
  });

  it('groups values From their type and lists a removed field as plain text, tracking the open', () => {
    panel(card(KEPT));
    fireEvent.click(screen.getByRole('tab', { name: 'Hidden, 3 values' }));
    expect(track).toHaveBeenCalledWith('Plan', 'Opened', 'HiddenValues');
    expect(
      screen.getByText('Values this card keeps from fields its Work Item type doesn’t show.'),
    ).toBeTruthy();
    const idea = within(screen.getByRole('region', { name: 'From Idea' }));
    expect(idea.getByText('Solution')).toBeTruthy();
    expect(idea.getByText('Size')).toBeTruthy();
    const removed = within(screen.getByRole('region', { name: 'Removed Fields' }));
    expect(removed.getByText('Removed Field')).toBeTruthy();
    expect(removed.getByText('a, b')).toBeTruthy();
    // Drawn read-only by kind: the number box is disabled.
    expect(idea.getByDisplayValue<HTMLInputElement>('3').disabled).toBe(true);
  });

  it('gives an Editor Copy To Field, only into fields that can take it, and Remove, each one write', () => {
    const { onPatch } = panel(card({ ...KEPT, description: 'Old' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Hidden, 3 values' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Solution to a field' }));
    const items = screen.getAllByRole('menuitem').map((m) => m.textContent);
    expect(items).toEqual(['Acceptance Criteria', 'Description (replaces its value)']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Acceptance Criteria' }));
    expect(onPatch).toHaveBeenLastCalledWith({ set: { 'f-criteria': 'Map by name' } });
    expect(track).toHaveBeenCalledWith('Plan', 'Copied', 'HiddenValue');
    // A Number fits no field of a Work Item; a removed field copies nowhere.
    const size = screen.getByRole('button', { name: 'Copy Size to a field' }) as HTMLButtonElement;
    expect(size.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Copy Removed Field to a field' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Removed Field' }));
    expect(onPatch).toHaveBeenLastCalledWith({ clear: ['f-gone'] });
    expect(track).toHaveBeenCalledWith('Plan', 'Removed', 'HiddenValue');
  });

  it.each(['participant', 'viewer'] as const)('is read-only for a %s', (role) => {
    panel(card(KEPT), role);
    fireEvent.click(screen.getByRole('tab', { name: 'Hidden, 3 values' }));
    expect(screen.getByText('Solution')).toBeTruthy();
    expect(screen.queryByRole('button', { name: / to a field$/ })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /^Remove (Solution|Size|Removed Field)$/ }),
    ).toBeNull();
  });

  it('updates live and goes when the last value goes, or the card is back on its type', () => {
    const { rerender } = panel(card(KEPT));
    fireEvent.click(screen.getByRole('tab', { name: 'Hidden, 3 values' }));
    rerender(card({ 'f-solution': 'Map by name' }));
    expect(screen.getByRole('tab', { name: 'Hidden, 1 value' })).toBeTruthy();
    rerender(card({ 'f-solution': 'Map by name' }, 'idea'));
    expect(tabNames()).not.toContain('Hidden');
    // The panel falls back to the type's first tab.
    expect(screen.getAllByRole('tab')[0]!.getAttribute('aria-selected')).toBe('true');
  });
});
