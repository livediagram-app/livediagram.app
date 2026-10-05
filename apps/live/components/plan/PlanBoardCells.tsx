'use client';

// A Plan board's rows and cards (docs/specs/025-plan/plan-board.md "What the board shows"), drawn by
// PlanBoardView: a row's collapsible band when the board has swimlanes, and one card in a cell.
import { ITEM_TYPES, itemAccessibleName, type Item, type LaneHead } from '@livediagram/items';
import { usePlan } from './PlanContext';
import { PersonDisc } from './PersonDisc';
import { PlanCardFace } from './PlanCardFace';
import type { PlanPalette } from './plan-palette';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// A row of the board: with swimlanes, a labelled, collapsible band over its cells.
export function LaneRow({
  lane,
  withLanes,
  span,
  palette,
  shut,
  onToggle,
  children,
}: {
  lane: LaneHead;
  withLanes: boolean;
  span: number;
  palette: PlanPalette;
  shut: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (!withLanes) return <>{children}</>;
  return (
    <>
      <button
        type="button"
        className="flex items-center gap-2 rounded-md px-1 pt-2 text-left text-[12px] font-semibold enabled:cursor-pointer"
        style={{ gridColumn: `span ${span}`, color: palette.muted }}
        aria-expanded={!shut}
        onPointerDown={stop}
        onClick={onToggle}
      >
        <span aria-hidden>{shut ? '▸' : '▾'}</span>
        {lane.person ? <PersonDisc person={lane.person} /> : null}
        <span style={{ color: palette.text }}>{lane.label}</span>
      </button>
      {children}
    </>
  );
}

// One card in a cell: a focusable list item that the pointer picks up in Plan mode.
export function PlanBoardCard({
  item,
  palette,
  placeholderBefore,
  lifted,
  done,
  setupFields,
  faceDown,
  voting,
  presence,
  interactive,
  onPress,
  onOpen,
  onKey,
}: {
  item: Item;
  palette: PlanPalette;
  placeholderBefore: number | undefined;
  lifted: boolean;
  done: boolean;
  setupFields: Parameters<typeof PlanCardFace>[0]['fields'];
  faceDown: boolean;
  voting: Parameters<typeof PlanCardFace>[0]['voting'];
  presence: Parameters<typeof PlanCardFace>[0]['presence'];
  interactive: boolean;
  onPress: (id: string, e: React.PointerEvent<HTMLElement>) => void;
  onOpen: () => void;
  onKey: (item: Item, e: React.KeyboardEvent<HTMLElement>) => void;
}) {
  const types = usePlan()?.types ?? ITEM_TYPES;
  return (
    <>
      {placeholderBefore !== undefined ? (
        <div
          className="rounded-lg border-2 border-dashed"
          style={{ height: placeholderBefore, borderColor: palette.focus }}
          aria-hidden
        />
      ) : null}
      <div
        role="listitem"
        tabIndex={0}
        data-plan-card={item.id}
        aria-label={faceDown ? 'Hidden card' : itemAccessibleName(item, types)}
        className="rounded-lg outline-none transition-opacity focus-visible:ring-2"
        style={{
          opacity: lifted ? 0.35 : 1,
          cursor: interactive ? 'grab' : undefined,
          ['--tw-ring-color' as string]: palette.focus,
        }}
        onPointerDown={(e) => onPress(item.id, e)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        onKeyDown={(e) => onKey(item, e)}
      >
        <PlanCardFace
          item={item}
          palette={palette}
          fields={setupFields}
          faceDown={faceDown}
          muted={done}
          presence={presence}
          voting={faceDown ? undefined : voting}
        />
      </div>
    </>
  );
}
