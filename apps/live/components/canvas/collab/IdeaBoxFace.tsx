// The face of an Idea box (docs/specs/012-collaboration/idea-box.md): anonymous ideas, sealed until the
// facilitator opens the box. Built from the Q&A board's parts ("The look"):
// the shared accent scope, the composer at the foot, its row style, its empty
// state and its motion.
//
// Closed, it shows a count and NOT the text, not even to the person who wrote
// one. A box that shows you your own card tells the room what you wrote the
// moment somebody watches you type it.

import { CountBadge } from '@/components/primitives/CountBadge';
import { useState } from 'react';
import { IDEA_MAX_TEXT, type ShapeElement } from '@livediagram/diagram';
import { CollabPanel, tint } from './collab-chrome';
import { CollabAccentScope } from './collab-accent';
import { CollabComposer } from './CollabComposer';
import { IdeaRow } from './idea/IdeaRow';
import { IdeaSealed } from './idea/IdeaSealed';
import {
  AccentBar,
  EmptyRows,
  EyeGlyph,
  MaskGlyph,
  QA_ACCENT,
  QA_ACCENT_INK,
  ScatterGlyph,
} from './qa/qa-parts';
import {
  ElementEllipsisMenu,
  ElementMenuItem,
  ElementMenuSettingsRow,
} from '@/components/canvas/ElementEllipsisMenu';

export function IdeaBoxFace({
  element,
  label,
  textColor,
  surface,
  onAddIdea,
  onReveal,
  onClear,
  onOpenSettings,
  onScatter,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  /** The card's own fill, for the accent scope. */
  surface: string;
  onAddIdea?: (text: string) => void;
  onReveal?: () => void;
  // Empty the box for the next round. It lives in the `…` rather than beside
  // Open the box: opening is the act the element exists for, and a Clear
  // sitting next to it is a mis-tap that throws away everything the room wrote.
  onClear?: () => void;
  /** The way out of the round controls to the element's full menu (docs/specs/008-canvas/canvas-and-palette.md). */
  onOpenSettings?: () => void;
  // Turns the open box's cards into ordinary sticky notes (docs/specs/012-collaboration/idea-box.md) so they
  // can be grouped, moved and dot-voted like anything else on the board.
  onScatter?: () => void;
}) {
  const cards = element.ideaCards ?? [];
  const open = element.ideasRevealed === true;
  // Ideas past this index arrived after the box first painted, and slide in.
  const [initialCount] = useState(cards.length);

  const menu =
    onClear || onOpenSettings ? (
      <ElementEllipsisMenu label="Idea box options" color={textColor} align="left">
        {(close) => (
          <>
            {onClear ? (
              <ElementMenuItem
                onPress={() => {
                  onClear();
                  close();
                }}
              >
                Empty the box
                {cards.length ? <CountBadge count={cards.length} /> : null}
              </ElementMenuItem>
            ) : null}
            {onOpenSettings ? (
              <ElementMenuSettingsRow
                onOpen={() => {
                  onOpenSettings();
                  close();
                }}
              />
            ) : null}
          </>
        )}
      </ElementEllipsisMenu>
    ) : undefined;

  return (
    <CollabAccentScope element={element} textColor={textColor} surface={surface}>
      <CollabPanel
        element={element}
        // Resizing makes room for more ideas rather than bigger ones.
        reflow
        title={label.trim() || 'Ideas'}
        textColor={textColor}
        aside={
          cards.length ? `${cards.length} ${cards.length === 1 ? 'idea' : 'ideas'}` : undefined
        }
        headerExtra={menu}
        footer={
          onAddIdea ? (
            <CollabComposer
              textColor={textColor}
              placeholder="Add an idea…"
              ariaLabel="Add an anonymous idea"
              sendLabel="Submit idea"
              maxLength={IDEA_MAX_TEXT}
              onSubmit={(text) => onAddIdea(text)}
              meta={<AnonymousBadge />}
            />
          ) : undefined
        }
      >
        {!open && onReveal && cards.length > 0 ? (
          <AccentBar onPress={onReveal} icon={<EyeGlyph />} count={cards.length}>
            Open the box
          </AccentBar>
        ) : null}
        {open && onScatter && cards.length > 0 ? (
          <AccentBar onPress={onScatter} icon={<ScatterGlyph />}>
            Scatter to sticky notes
          </AccentBar>
        ) : null}

        {cards.length === 0 ? (
          <EmptyRows textColor={textColor} title="Nothing in the box yet">
            {onAddIdea
              ? 'Be the first to add an idea. Nobody’s name is stored with it.'
              : undefined}
          </EmptyRows>
        ) : open ? (
          <ul className="flex flex-col gap-1.5">
            {cards.map((card, i) => (
              <IdeaRow
                key={`${i}-${card.slice(0, 12)}`}
                text={card}
                index={i}
                fresh={i >= initialCount}
                textColor={textColor}
              />
            ))}
          </ul>
        ) : (
          <IdeaSealed count={cards.length} textColor={textColor} />
        )}
      </CollabPanel>
    </CollabAccentScope>
  );
}

// Where the Q&A board has an Anonymous switch, the Idea box states it: there
// is nothing to switch, and saying so where you write is the reassurance the
// element exists to give.
function AnonymousBadge() {
  return (
    <span
      className="pointer-events-auto inline-flex items-center gap-1 rounded-full py-0.5 pl-1 pr-2 text-[10px] font-semibold"
      style={{ color: QA_ACCENT_INK, backgroundColor: tint(QA_ACCENT, 0.14) }}
    >
      <MaskGlyph size={11} />
      Anonymous
    </span>
  );
}
