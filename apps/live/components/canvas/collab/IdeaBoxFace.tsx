// The face of an Idea box (spec/125): a prompt, a field anyone can type into,
// and a count that becomes the cards once the box is opened.
//
// Closed, it shows a count and NOT the text — not even to the person who wrote
// one. A box that shows you your own card tells the room what you wrote the
// moment somebody watches you type it.

import { useState } from 'react';
import type { ShapeElement } from '@livediagram/diagram';
import { CollabButton, CollabEmpty, CollabPanel, tint } from './collab-chrome';

export function IdeaBoxFace({
  element,
  label,
  textColor,
  onAddIdea,
  onReveal,
  onScatter,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  onAddIdea?: (text: string) => void;
  onReveal?: () => void;
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
      title={label.trim() || 'Ideas'}
      textColor={textColor}
      aside={cards.length ? `${cards.length} ${cards.length === 1 ? 'idea' : 'ideas'}` : undefined}
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
