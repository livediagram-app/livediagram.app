// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ARCHIVED_FIELD,
  ITEM_TYPES,
  TRASH_STATUS,
  linkedCardsOf,
  type CustomFieldDef,
  type Item,
  type ItemTypeDef,
  type StatusPhase,
} from '@liveplanner/items';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { PlanCardFace } from './PlanCardFace';
import { planPalette } from './plan-palette';
import { BLOCKS_LINE, BlocksSwitch } from './ItemTypeFieldForms';
import { addedField } from './AddFieldShape';
import { BlockedBySections } from './BlockedBy';
import { LinkedCardGroup } from './LinkedCards';
import { ItemFieldEditor, type ItemFieldContext } from './ItemFieldEditor';
import { planBlocking } from './blocking';
import { contrastRatio } from '@liveplanner/project';

// docs/specs/026-plan/item-types.md "Blocked By": the switch, the badge at every size, the panel's two lists, the
// picker's loop refusal and who may set a link (docs/specs/013-workspace/share-roles.md).
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
beforeEach(() => track.mockClear());
afterEach(cleanup);

const BY = { id: 'p', name: 'P', color: '#000000' };
const BLOCKED_BY: CustomFieldDef = {
  id: 'f-bb',
  label: 'Blocked By',
  kind: 'card',
  linkType: 'task',
  multiple: true,
  blocks: true,
};
const TYPES: ItemTypeDef[] = ITEM_TYPES.map((t) =>
  t.id === 'task'
    ? { ...t, fields: [...t.fields, BLOCKED_BY.id], custom: [...(t.custom ?? []), BLOCKED_BY] }
    : t,
);
const PHASES = new Map<string, StatusPhase>([
  ['todo', 'todo'],
  ['doing', 'doing'],
  ['done', 'done'],
]);
const NAMES = new Map([
  ['todo', 'To Do'],
  ['doing', 'Doing'],
  ['done', 'Done'],
]);
let n = 0;
const card = (title: string, status: string, blockers: string[] = [], extra = {}): Item => {
  n += 1;
  return {
    id: `c${n}`,
    type: 'task',
    key: n,
    rank: `r${n}`,
    fields: {
      title,
      status,
      ...(blockers.length ? { [BLOCKED_BY.id]: blockers } : {}),
      ...extra,
    },
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: BY,
    updatedBy: BY,
  };
};

const announce = vi.fn();
const notify = vi.fn();
function planOf(items: Item[], role: { canEdit: boolean; canEditCards: boolean }) {
  return {
    items: new Map(items.map((i) => [i.id, i])),
    types: TYPES,
    statusPhases: PHASES,
    statusNames: NAMES,
    announce,
    notify,
    ...role,
  } as unknown as PlanContextValue;
}
const EDITOR = { canEdit: true, canEditCards: true };
const PARTICIPANT = { canEdit: false, canEditCards: true };
const VIEWER = { canEdit: false, canEditCards: false };

describe('the Blocks switch', () => {
  it('shows on a Card field only, turns Holds Several on with it, and is tracked', () => {
    const onChange = vi.fn();
    render(<BlocksSwitch field={{ kind: 'text' }} onChange={onChange} />);
    expect(screen.queryByText('Blocks')).toBeNull();
    cleanup();
    render(<BlocksSwitch field={{ kind: 'card' }} onChange={onChange} />);
    expect(screen.getByText(BLOCKS_LINE)).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: /Blocks/ }));
    expect(onChange).toHaveBeenCalledWith({ blocks: true, multiple: true });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'FieldBlocks');
    cleanup();
    render(<BlocksSwitch field={{ kind: 'card', blocks: true }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: /Blocks/ }));
    expect(onChange).toHaveBeenLastCalledWith({ blocks: undefined });
  });

  it('is kept by Add Field only on a Card field', () => {
    expect(addedField({ label: ' Blocked By ', kind: 'card', blocks: true }).blocks).toBe(true);
    expect(addedField({ label: 'Notes', kind: 'text', blocks: true }).blocks).toBeUndefined();
  });
});

describe('the blocked badge', () => {
  const face = (item: Item, items: Item[], size: 'minimal' | 'detailed', stacked = false) =>
    render(
      <PlanProvider value={planOf(items, VIEWER)}>
        <PlanCardFace
          item={item}
          palette={planPalette('light', {})}
          fields={['key', 'type']}
          size={size}
          stacked={stacked}
        />
      </PlanProvider>,
    );

  it('shows its open blockers at every size, ignoring done, trashed and archived ones', () => {
    const a = card('Website', 'doing');
    const b = card('Copy', 'todo');
    const done = card('Old', 'done');
    const gone = card('Gone', TRASH_STATUS);
    const shelved = card('Shelved', 'todo', [], { [ARCHIVED_FIELD]: true });
    const launch = card('Launch', 'todo', [a.id, b.id, done.id, gone.id, shelved.id]);
    const all = [a, b, done, gone, shelved, launch];
    for (const [size, stacked] of [
      ['minimal', false],
      ['minimal', true],
      ['detailed', false],
    ] as const) {
      face(launch, all, size, stacked);
      const badge = screen.getByRole('img', { name: 'Blocked by 2 open cards' });
      expect(badge.textContent).toBe('2');
      cleanup();
    }
    face(a, all, 'detailed');
    expect(document.querySelector('[data-blocked-mark]')).toBeNull();
    cleanup();
    // Every blocker done: the badge clears itself.
    const doneLaunch = card('Launch', 'todo', [done.id]);
    face(doneLaunch, [done, doneLaunch], 'minimal');
    expect(document.querySelector('[data-blocked-mark]')).toBeNull();
  });

  it('draws its count at AA contrast on a light and a dark card', () => {
    const a = card('Website', 'doing');
    const launch = card('Launch', 'todo', [a.id]);
    for (const surface of ['light', 'dark'] as const) {
      const palette = planPalette(surface, {});
      render(
        <PlanProvider value={planOf([a, launch], VIEWER)}>
          <PlanCardFace item={launch} palette={palette} fields={['key']} size="minimal" />
        </PlanProvider>,
      );
      const badge = document.querySelector<HTMLElement>('[data-blocked-mark]')!;
      const hex = (rgb: string) =>
        '#' +
        rgb
          .match(/\d+/g)!
          .slice(0, 3)
          .map((n) => Number(n).toString(16).padStart(2, '0'))
          .join('');
      const ink = badge.style.color.startsWith('#') ? badge.style.color : hex(badge.style.color);
      expect(contrastRatio(ink, palette.card)).toBeGreaterThanOrEqual(4.5);
      cleanup();
    }
  });

  it('builds the lookup once per items change', () => {
    const a = card('A', 'todo');
    const b = card('B', 'todo', [a.id]);
    const plan = planOf([a, b], VIEWER);
    expect(planBlocking(plan)).toBe(planBlocking(plan));
    expect(planBlocking(plan).open.get(b.id)).toBe(1);
    expect(planBlocking({ ...plan, items: new Map(plan.items) })).not.toBe(planBlocking(plan));
  });
});

describe('the item panel', () => {
  it('lists a card’s blockers with their state, ticks the done ones, and opens each', () => {
    const a = card('Website', 'doing');
    const done = card('Old', 'done');
    const launch = card('Launch', 'todo', [a.id, done.id]);
    const onOpen = vi.fn();
    render(
      <PlanProvider value={planOf([a, done, launch], VIEWER)}>
        <BlockedBySections
          item={launch}
          type={TYPES.find((t) => t.id === 'task')!}
          onOpen={onOpen}
        />
      </PlanProvider>,
    );
    const section = screen.getByRole('region', { name: /Blocked By/ });
    expect(within(section).getByText('1 open').className).toContain('dark:text-red-400');
    expect(section.querySelectorAll('[data-blocker-done]')).toHaveLength(1);
    fireEvent.click(within(section).getByRole('button', { name: `Open #${a.key} Website, Doing` }));
    expect(onOpen).toHaveBeenCalledWith(a.id);
    cleanup();
    const allDone = card('Later', 'todo', [done.id]);
    render(
      <PlanProvider value={planOf([done, allDone], VIEWER)}>
        <BlockedBySections
          item={allDone}
          type={TYPES.find((t) => t.id === 'task')!}
          onOpen={onOpen}
        />
      </PlanProvider>,
    );
    expect(screen.getByText('All done')).toBeTruthy();
  });

  it('shows the Blocks mirror read-only, and not at all when empty', () => {
    const a = card('Website', 'doing');
    const launch = card('Launch', 'todo', [a.id]);
    const items = new Map([a, launch].map((i) => [i.id, i]));
    const groupOn = (target: Item) => linkedCardsOf(target, items, TYPES).find((g) => g.blocks)!;
    const draw = (target: Item) =>
      render(
        <PlanProvider value={planOf([a, launch], EDITOR)}>
          <LinkedCardGroup
            group={groupOn(target)}
            target={target}
            types={TYPES}
            statusNames={NAMES}
            canAdd
            onOpen={vi.fn()}
            onAdd={vi.fn()}
            onLinkExisting={vi.fn()}
          />
        </PlanProvider>,
      );
    draw(a);
    const section = screen.getByRole('region', { name: /^Blocks/ });
    expect(within(section).getByText('Launch')).toBeTruthy();
    expect(screen.queryByText(/^New /)).toBeNull();
    expect(screen.queryByText('Link Existing')).toBeNull();
    cleanup();
    draw(launch);
    expect(screen.queryByRole('region')).toBeNull();
  });
});

describe('the Blocked By control', () => {
  const ctxOf = (item: Item, canEdit: boolean): ItemFieldContext =>
    ({
      item,
      type: TYPES.find((t) => t.id === 'task')!,
      statuses: [],
      people: [],
      labels: [],
      canEdit,
      onSave: vi.fn(),
      onPatch: vi.fn(),
      onOpenItem: vi.fn(),
    }) satisfies ItemFieldContext;
  const draw = (item: Item, items: Item[], role: typeof EDITOR) => {
    const ctx = ctxOf(item, role.canEditCards);
    render(
      <PlanProvider value={planOf(items, role)}>
        <ItemFieldEditor f={BLOCKED_BY.id} ctx={ctx} />
      </PlanProvider>,
    );
    return ctx.onSave as ReturnType<typeof vi.fn>;
  };

  it('draws a chip’s number at AA contrast on the chip', () => {
    const a = card('Website', 'doing');
    const launch = card('Launch', 'todo', [a.id]);
    draw(launch, [a, launch], EDITOR);
    const key = screen.getByText(`#${a.key}`);
    expect(key.className.split(/\s+/)).toContain('text-slate-600');
  });

  it('refuses a pick that closes a loop, says why, and marks such cards', () => {
    announce.mockClear();
    notify.mockClear();
    const a = card('Website', 'doing');
    const launch = card('Launch', 'todo', [a.id]);
    const other = card('Other', 'todo');
    const onSave = draw(a, [a, launch, other], EDITOR);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Blocked By' }));
    const looped = screen.getByRole('option', {
      name: `#${launch.key} Launch, waits on this card`,
    });
    expect(screen.getByText('Waits on this card')).toBeTruthy();
    fireEvent.click(looped);
    const message = `#${launch.key} Launch already waits on #${a.key} Website, so it can't block it.`;
    expect(announce).toHaveBeenCalledWith(message);
    expect(notify).toHaveBeenCalledWith(message);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('option', { name: `#${other.key} Other` }));
    expect(onSave).toHaveBeenCalledWith(BLOCKED_BY.id, [other.id]);
  });

  it('lets an Editor set links, and shows a Participant and a Viewer the chips alone', () => {
    const a = card('Website', 'doing');
    const launch = card('Launch', 'todo', [a.id]);
    draw(launch, [a, launch], EDITOR);
    expect(screen.getByRole('button', { name: 'Add to Blocked By' })).toBeTruthy();
    cleanup();
    for (const role of [PARTICIPANT, VIEWER]) {
      draw(launch, [a, launch], role);
      expect(screen.getByText('Website')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Add to Blocked By' })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
      cleanup();
    }
  });
});
