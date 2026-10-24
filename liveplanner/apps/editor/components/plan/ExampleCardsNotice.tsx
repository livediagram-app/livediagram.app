'use client';

// The example cards notice (docs/specs/026-plan/plan-templates.md "Example cards"): a one-line strip under a board's
// header while the project holds example cards the board shows. Clear Example Cards sends every example card of the
// project to the Trash; Keep Them takes the flag off every one. Either is one write and one undo step, and either
// leaves no example card, so the strip goes for everyone. An Editor's alone: a Participant may not trash or reshape
// others' cards (docs/specs/013-workspace/share-roles.md), and a Viewer only looks.
import { lucideInfo } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveplanner/ui';
import {
  EXAMPLE_FIELD,
  isExampleItem,
  isTrashed,
  type Item,
  type ItemPatchOf,
} from '@liveplanner/items';
import { track } from '@/lib/telemetry';
import type { PlanPalette } from './plan-palette';
import type { PlanContextValue } from './PlanContext';

const InfoIcon = lucideGlyph(lucideInfo, 14);

// The project's example cards still on a board (not in the Trash).
export function exampleCardIds(items: Iterable<Item>): string[] {
  const ids: string[] = [];
  for (const item of items) if (isExampleItem(item) && !isTrashed(item)) ids.push(item.id);
  return ids;
}

export function ExampleCardsNotice({
  shown,
  plan,
  palette,
}: {
  // The cards this board shows: the strip is on a board that shows an example card.
  shown: readonly Item[];
  plan: Pick<PlanContextValue, 'items' | 'canEdit' | 'trashItems' | 'patchItems' | 'announce'>;
  palette: PlanPalette;
}) {
  if (!plan.canEdit || !shown.some(isExampleItem)) return null;
  const clear = () => {
    // Sent first, so the event reaches the wire whatever the write does.
    track('Plan', 'Deleted', 'ExampleCards');
    const went = plan.trashItems(exampleCardIds(plan.items.values()));
    plan.announce(`${went === 1 ? '1 example card' : `${went} example cards`} moved to the Trash`);
  };
  const keep = () => {
    track('Plan', 'Changed', 'ExampleCardsKept');
    const patches: ItemPatchOf[] = exampleCardIds(plan.items.values()).map((id) => ({
      id,
      patch: { clear: [EXAMPLE_FIELD] },
    }));
    plan.patchItems?.(patches);
    plan.announce('Example cards kept as your own');
  };
  const button =
    'h-7 shrink-0 cursor-pointer rounded-md border px-2 text-[12px] font-medium transition hover:opacity-80';
  return (
    <div
      role="status"
      data-example-cards-notice
      className="mx-3 mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border px-3 py-1.5 text-[12px]"
      style={{ borderColor: palette.border, backgroundColor: palette.column, color: palette.muted }}
    >
      <span aria-hidden className="shrink-0" style={{ color: palette.focus }}>
        <InfoIcon />
      </span>
      {/* A basis of its own, so on a narrow board the buttons wrap under the sentence rather than crush it. */}
      <span className="min-w-0 flex-1 basis-48">Example cards show how this board runs.</span>
      <button
        type="button"
        className={button}
        style={{ borderColor: palette.focus, color: palette.focus }}
        onClick={clear}
      >
        Clear Example Cards
      </button>
      <button
        type="button"
        className={button}
        style={{ borderColor: palette.border, color: palette.text }}
        onClick={keep}
      >
        Keep Them
      </button>
    </div>
  );
}
