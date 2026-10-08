'use client';

// A Plan board's rows and cards (docs/specs/026-plan/plan-board.md "What the board shows"), drawn by
// PlanBoardView: a row's collapsible band when the board has swimlanes, one card in a cell, and the
// card under the pointer while it is dragged.
import { itemVoteKey } from '@livediagram/document';
import { ElementVoteOverlay } from '@/components/canvas/ElementVoteOverlay';
import type { CardVote } from './CardVoteContext';
import { useLongPress } from '@/hooks/ui/useLongPress';
import { usePlanDragPointer, type PlanDragPointerStore } from '@/hooks/plan/usePlanCardDrag';
import { createPortal } from 'react-dom';
import {
  ITEM_TYPES,
  itemAccessibleName,
  itemTitle,
  type Item,
  type LaneHead,
} from '@livediagram/items';
import { usePlan } from './PlanContext';
import { PersonDisc } from './PersonDisc';
import { ColourDot } from './ColourSwatches';
import { PlanCardFace } from './PlanCardFace';
import type { PlanPalette } from './plan-palette';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

const REFUSED_COLOUR = '#dc2626';

// The gap a held card would land in, dashed in the board's focus colour; or, for a palette card of a type the board
// does not show (`refused`), a red dashed zone saying why (docs/specs/026-plan/plan-mode.md "The palette").
export function DropGap({
  height,
  palette,
  refused,
}: {
  height: number;
  palette: PlanPalette;
  refused?: string | undefined;
}) {
  if (!refused)
    return (
      <div
        className="rounded-lg border-2 border-dashed"
        style={{ height, borderColor: palette.focus }}
        aria-hidden
      />
    );
  return (
    <div
      role="status"
      className="flex items-center justify-center rounded-lg border-2 border-dashed px-2 text-center text-[12px] font-medium leading-snug"
      style={{
        minHeight: height,
        borderColor: REFUSED_COLOUR,
        color: REFUSED_COLOUR,
        backgroundColor: `color-mix(in srgb, ${REFUSED_COLOUR} 8%, transparent)`,
      }}
    >
      {refused}
    </div>
  );
}

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
        {lane.colour ? <ColourDot colour={lane.colour} /> : null}
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
  cardSize,
  faceDown,
  voting,
  presence,
  interactive,
  onPress,
  onOpen,
  onKey,
  onMenu,
  onLongPress,
  cardVote,
}: {
  item: Item;
  palette: PlanPalette;
  placeholderBefore: number | undefined;
  lifted: boolean;
  done: boolean;
  setupFields: Parameters<typeof PlanCardFace>[0]['fields'];
  cardSize: Parameters<typeof PlanCardFace>[0]['size'];
  faceDown: boolean;
  voting: Parameters<typeof PlanCardFace>[0]['voting'];
  presence: Parameters<typeof PlanCardFace>[0]['presence'];
  interactive: boolean;
  onPress: (id: string, e: React.PointerEvent<HTMLElement>) => void;
  onOpen: () => void;
  onKey: (item: Item, e: React.KeyboardEvent<HTMLElement>) => void;
  // A right-click (or the context-menu key) on the card, at a screen point.
  onMenu: (item: Item, at: { x: number; y: number }) => void;
  // A finger held on the card (touch has no right-click): its menu, at the finger. Absent, a hold does nothing.
  onLongPress?: (item: Item, at: { x: number; y: number }) => void;
  // The tab's session vote, when this board's cards take dots in it (docs/specs/012-collaboration/session-tools.md
  // "Voting on Plan cards"): the card carries the vote's stepper, unless it is face down.
  cardVote?: CardVote | null;
}) {
  const types = usePlan()?.types ?? ITEM_TYPES;
  const hold = useLongPress((x, y) => onLongPress?.(item, { x, y }));
  return (
    <>
      {placeholderBefore !== undefined ? (
        <DropGap height={placeholderBefore} palette={palette} />
      ) : null}
      <div
        role="listitem"
        tabIndex={0}
        data-plan-card={item.id}
        aria-label={faceDown ? 'Hidden card' : itemAccessibleName(item, types)}
        // touch-none: a finger on a card drags it, never scrolls the board under it (a maximised board scrolls).
        className="relative touch-none rounded-lg outline-none transition-opacity focus-visible:ring-2"
        style={{
          opacity: lifted ? 0.35 : 1,
          cursor: interactive ? 'grab' : undefined,
          ['--tw-ring-color' as string]: palette.focus,
        }}
        onPointerDown={(e) => {
          if (onLongPress && !faceDown) hold.onPointerDown(e);
          onPress(item.id, e);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        onKeyDown={(e) => onKey(item, e)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (faceDown) return;
          const rect = e.currentTarget.getBoundingClientRect();
          // The keyboard's context-menu key has no point: open at the card instead.
          const keyboard = e.clientX === 0 && e.clientY === 0;
          onMenu(
            item,
            keyboard ? { x: rect.left + 8, y: rect.bottom } : { x: e.clientX, y: e.clientY },
          );
        }}
      >
        <PlanCardFace
          item={item}
          palette={palette}
          fields={setupFields}
          size={cardSize}
          faceDown={faceDown}
          muted={done}
          presence={presence}
          voting={faceDown ? undefined : voting}
        />
        {cardVote ? (
          <ElementVoteOverlay
            voteKey={itemVoteKey(item.id)}
            name={faceDown ? 'this card' : itemTitle(item) || 'this card'}
            vote={cardVote.vote}
            selfId={cardVote.selfId}
            voteMax={cardVote.voteMax}
            votableInVote={!faceDown}
            voteReviewActive={cardVote.reviewActive}
            isVoteFocus={cardVote.focusKey === itemVoteKey(item.id)}
            onCastVote={cardVote.onCast}
            onRetractVote={cardVote.onRetract}
          />
        ) : null}
      </div>
    </>
  );
}

// The card under the pointer while it is dragged, over everything (portalled to the body).
export function PlanDragGhost({
  drag,
  pointer,
  item,
  palette,
  fields,
  size,
}: {
  drag: {
    clientX: number;
    clientY: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  };
  // The pointer's place each frame; the drag state above changes only with the slot.
  pointer: PlanDragPointerStore;
  item: Item;
  palette: PlanPalette;
  fields: Parameters<typeof PlanCardFace>[0]['fields'];
  size: Parameters<typeof PlanCardFace>[0]['size'];
}) {
  const at = usePlanDragPointer(pointer) ?? drag;
  return createPortal(
    <div
      className="pointer-events-none fixed z-[1000] rotate-2 opacity-90 shadow-xl motion-reduce:rotate-0"
      style={{
        left: at.clientX - drag.offsetX,
        top: at.clientY - drag.offsetY,
        width: drag.width,
        height: drag.height,
      }}
    >
      <PlanCardFace item={item} palette={palette} fields={fields} size={size} />
    </div>,
    document.body,
  );
}
