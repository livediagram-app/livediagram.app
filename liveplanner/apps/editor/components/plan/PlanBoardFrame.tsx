'use client';

// A Plan board's frame (PlanBoardView.tsx): its region with the header, the selection bar and example-cards notice,
// the scrolling body holding Setup Board and the grid, a card's menu and the dragged card's ghost.
import { CARD_FIELDS } from '@liveplanner/items';
import { planBoardBodyCursor } from './board-cursors';
import { planBoardFontStyle } from '@/lib/plan-font';
import { PlanDragGhost } from './PlanBoardCells';
import { SetupBoardHost } from './SetupBoardHost';
import { centreTappedColumn } from './phone-board';
import { PlanCardMenuHost } from './PlanCardMenu';
import { COLUMN_ATTR } from './column-move-flip';
import { SLOT_BOARD_GROUP } from './SlotBoardHeader';
import { ExampleCardsNotice } from './ExampleCardsNotice';
import { BoardSelectionBar } from './BoardSelectionBar';
import { boardSurface, keepBoardPress } from './plan-board-view-consts';
import { planBoardViewHeader } from './PlanBoardViewHeader';
import { planBoardGrid } from './PlanBoardGrid';
import type { PlanBoardViewValues } from './plan-board-view-values';

export function PlanBoardFrame({ v }: { v: PlanBoardViewValues }) {
  const {
    boardRef,
    bodyRef,
    element,
    busy,
    cardSize,
    setup,
    simplified,
    palette,
    radius,
    cornerVars,
    fontFamily,
    textScale,
    plan,
    selection,
    interactive,
    shownItems,
    look,
    slotBoard,
    fullSetup,
    canEdit,
    canEditCards,
    pickable,
    menu,
    setMenu,
    dragging,
    items,
    drag,
  } = v;
  return (
    <div
      ref={boardRef}
      data-plan-board={element.id}
      data-plan-busy={busy ? (cardSize ?? 'detailed') : undefined}
      role="region"
      aria-label={setup.title}
      // `isolate`: the sticky column heads stack inside the board, never over another element.
      className={`absolute inset-0 isolate flex flex-col overflow-hidden border ${simplified ? SLOT_BOARD_GROUP : ''}`}
      style={{
        // Its surface lets the tab's canvas show faintly through (plan-board.md "See-through surface"); its columns
        // and cards stay solid, so every word reads as before. A slot board stays solid on its Dashboard.
        backgroundColor: simplified ? palette.surface : boardSurface(palette.surface),
        borderColor: palette.border,
        color: palette.text,
        borderRadius: radius,
        ...cornerVars,
        ...planBoardFontStyle(fontFamily, textScale),
      }}
    >
      {planBoardViewHeader(v)}
      {/* A template's example cards: Clear Example Cards or Keep Them, for an Editor (ExampleCardsNotice); left on the
          board's tab by a slot board. */}
      {plan && selection.ids.size ? (
        <BoardSelectionBar
          plan={plan}
          setup={setup}
          ordered={selection.ordered}
          palette={palette}
          onClear={selection.clear}
        />
      ) : null}
      {interactive && plan && !simplified ? (
        <ExampleCardsNotice shown={shownItems} plan={plan} palette={palette} />
      ) : null}
      <div
        ref={bodyRef}
        // The runs' observer root (useCardRunReveal RUN_BODY_ATTR).
        data-plan-body=""
        // A scroll container resets touch-action, so without touch-none a finger on a card starts a native
        // scroll and the browser cancels the drag; the canvas pans across empty board instead. Maximised, filling
        // its tab or in a Dashboard slot, nothing under the board pans, so a finger on empty board scrolls the board
        // (and past its end, the Dashboard's page); each card is touch-none on its own, so a finger on one still
        // picks it up. On a phone its columns snap
        // centred, one at a time (phone-board.ts), change only on a sideways swipe meant for it (phone-swipe.ts; the
        // body is pan-y there), and a tap on a column's empty space glides it to the centre.
        // No top padding here: a scroll box's padding insets where its sticky column heads stick, which left a strip
        // of cards showing above them; the grid carries the heads' 12 px rest gap instead (plan-board.md "Column heads
        // stick flush"). plan-scroll: a scrollbar in the theme's colours and finish (globals.css).
        className={`plan-scroll min-h-0 flex-1 overflow-auto px-3 ${look.endClearance || 'pb-3'} ${look.container ? '@container' : ''} ${look.touch} ${look.overscroll} ${
          look.snap ? 'snap-x snap-mandatory' : ''
        } ${slotBoard ? 'scroll-edge-fade' : ''}`}
        // A press here never pans or moves the board, so no hand (board-cursors.ts).
        style={
          {
            cursor: planBoardBodyCursor(interactive),
            '--plan-scroll-ink': palette.text,
            '--plan-scroll-line': palette.border,
            '--plan-scroll-track': palette.column,
            '--plan-scroll-focus': palette.focus,
          } as React.CSSProperties
        }
        onPointerDown={interactive ? keepBoardPress : undefined}
        onClick={
          interactive && look.columns === 'phone'
            ? (e) => {
                if (bodyRef.current)
                  centreTappedColumn(e.target as Element, bodyRef.current, COLUMN_ATTR);
              }
            : undefined
        }
      >
        {/* Not set up yet: the placeholder; and Setup Board's dialog, for this person only, when open (new, or Board
            Setup's Setup Board run again over a set-up board). */}
        <SetupBoardHost
          elementId={element.id}
          setup={fullSetup ?? setup}
          palette={palette}
          canEdit={canEdit}
          pickable={pickable}
        />
        {setup.columns.length === 0 ? null : planBoardGrid(v)}
      </div>
      {menu && plan ? (
        <PlanCardMenuHost
          menu={menu}
          plan={plan}
          setup={setup}
          // A Participant works on cards (duplicates, moves, flags) and never retires them, as in the item panel.
          canEdit={canEditCards}
          canRetire={canEdit}
          onClose={() => setMenu(null)}
          {...(canEditCards && !simplified ? { onSelect: selection.start } : {})}
        />
      ) : null}
      {dragging && items.get(dragging.itemId) ? (
        <PlanDragGhost
          drag={dragging}
          pointer={drag.pointer}
          size={cardSize}
          stacked={slotBoard}
          item={items.get(dragging.itemId)!}
          palette={palette}
          fields={CARD_FIELDS}
          count={dragging.group?.length ?? 1}
        />
      ) : null}
    </div>
  );
}
