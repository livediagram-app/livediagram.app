// The face of an Idea box (spec/125): a prompt, a field anyone can type into,
// and a count that becomes the cards once the box is opened.
//
// Closed, it shows a count and NOT the text — not even to the person who wrote
// one. A box that shows you your own card tells the room what you wrote the
// moment somebody watches you type it.

import { useState } from 'react';
import type { ShapeElement } from '@livediagram/diagram';
import { CollabButton, CollabEmpty, CollabPanel, tint } from './collab-chrome';
import { BoxLid, Corrugation, TapeStrip } from '@/components/canvas/paper-kit';
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
  /** The card's own fill, for the posted card and the slot's depth. */
  surface: string;
  onAddIdea?: (text: string) => void;
  onReveal?: () => void;
  // Empty the box for the next round. It lives in the `…` rather than beside
  // Open the box: opening is the act the element exists for, and a Clear
  // sitting next to it is a mis-tap that throws away everything the room wrote.
  onClear?: () => void;
  /** The way out of the round controls to the element's full menu (spec/09). */
  onOpenSettings?: () => void;
  // Turns the open box's cards into ordinary sticky notes (spec/125) so they
  // can be grouped, moved and dot-voted like anything else on the board.
  onScatter?: () => void;
}) {
  const [draft, setDraft] = useState('');
  const cards = element.ideaCards ?? [];
  const open = element.ideasRevealed === true;

  const submit = () => {
    const text = draft.trim();
    if (!text || !onAddIdea) return;
    onAddIdea(text);
    setDraft('');
  };

  return (
    <CollabPanel
      element={element}
      title={label.trim() || 'Ideas'}
      textColor={textColor}
      aside={cards.length ? `${cards.length} ${cards.length === 1 ? 'idea' : 'ideas'}` : undefined}
      headerExtra={
        onClear || onOpenSettings ? (
          <ElementEllipsisMenu label="Idea box options" color={textColor}>
            {(close) => (
              <>
                {onClear ? (
                  <ElementMenuItem
                    onPress={() => {
                      onClear();
                      close();
                    }}
                  >
                    {cards.length ? `Empty the box (${cards.length})` : 'Empty the box'}
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
        ) : undefined
      }
      // A POSTING BOX (spec/122). The slot is the whole element in one shape:
      // things go in, nothing comes back out until somebody opens it.
      //
      // It began as a dark bar near the top edge, which read as a progress
      // track somebody had misplaced — a slot is only a slot if it is cut into
      // something. So the lid is its own band with a lip where it overhangs
      // the body, the mouth is sunk into it with the shadow on the inside, and
      // the body below is corrugated like the carton it is cut from. With
      // anything in the box a card sits caught half-way through the slot,
      // which says "not empty" from across the room in a way a count cannot.
      inset={{ top: 24 }}
      backdrop={<Corrugation textColor={textColor} from={30} />}
      overlay={
        <>
          <BoxLid textColor={textColor} surface={surface} posted={cards.length > 0} />
          {/* Taped shut while it is still closed. Opening the box is the act
              the element exists for, so the seal going is worth seeing. */}
          {open ? null : <TapeStrip textColor={textColor} />}
        </>
      }
      footer={
        <>
          {!open ? (
            <CollabButton
              tone="loud"
              textColor={textColor}
              onPress={onReveal && cards.length > 0 ? onReveal : undefined}
              tooltip={{
                title: 'Open the box',
                description:
                  'Shows every idea to the room. There is no closing it again — the flag protects the writing round, it is not a toggle.',
              }}
            >
              Open the box
            </CollabButton>
          ) : (
            <CollabButton
              textColor={textColor}
              onPress={onScatter && cards.length > 0 ? onScatter : undefined}
              tooltip={{
                title: 'Scatter to sticky notes',
                description:
                  'Turns each idea into an ordinary sticky note beside the box, still with nobody’s name on it.',
              }}
            >
              Scatter to stickies
            </CollabButton>
          )}
        </>
      }
    >
      {onAddIdea ? (
        <div className="flex gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // The canvas listens for plain keys (type-to-edit, shortcuts), so
              // every keystroke in here has to stop at the field.
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Add an idea…"
            aria-label="Add an anonymous idea"
            maxLength={500}
            className="pointer-events-auto min-w-0 flex-1 rounded-md border px-2.5 py-1.5 text-[11px] outline-none placeholder:opacity-50"
            style={{
              color: textColor,
              backgroundColor: tint(textColor, 0.05),
              borderColor: tint(textColor, 0.18),
            }}
          />
          <CollabButton textColor={textColor} onPress={submit} label="Submit idea">
            Add
          </CollabButton>
        </div>
      ) : null}
      <div>
        {cards.length === 0 ? (
          <CollabEmpty textColor={textColor}>
            Nothing in the box yet. Nobody’s name is recorded against what they add.
          </CollabEmpty>
        ) : open ? (
          <ul className="flex flex-col gap-1.5">
            {cards.map((card, i) => (
              <li
                key={`${i}-${card.slice(0, 12)}`}
                className="rounded-md px-2.5 py-1.5 text-[11px] leading-relaxed"
                style={{ color: textColor, backgroundColor: tint(textColor, 0.07) }}
              >
                {card}
              </li>
            ))}
          </ul>
        ) : (
          <CollabEmpty textColor={textColor}>
            {`${cards.length} ${cards.length === 1 ? 'idea is' : 'ideas are'} in the box. Nothing shows until it is opened.`}
          </CollabEmpty>
        )}
      </div>
    </CollabPanel>
  );
}
