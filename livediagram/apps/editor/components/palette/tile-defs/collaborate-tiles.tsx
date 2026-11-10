import {
  AgendaIcon,
  DecisionIcon,
  EstimateIcon,
  IdeaBoxIcon,
  QaBoardIcon,
  RollCallIcon,
  TemperatureIcon,
} from '@/components/palette/palette-icons';
import { Glyph } from '@livediagram/ui';
import { TILE_GLYPH_PX, type PaletteTileDef } from './types';

// The Collaborate elements: one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

export const COLLABORATE_TILES: PaletteTileDef[] = [
  // --- Collaborate (docs/specs/012-collaboration/estimate-card.md to docs/specs/012-collaboration/roll-call.md) ----------------------------------
  // Elements that collect what the ROOM thinks. Rows with a blurb, like
  // Behaviour: none of these glyphs can say what the element does, and
  // "everyone picks privately, then all at once" is the thing being chosen.
  {
    // Comment pin (docs/specs/012-collaboration/comment-pin.md): a remark about a PLACE rather than a shape.
    id: 'collab:comment-pin',
    blurb: 'A comment thread as a card on the canvas',
    caption: 'Comment',
    section: 'tools',
    toolGroup: 'behaviour',
    tileGroup: 'record',
    label: 'Add Comment Panel',
    description:
      'A card that carries a whole comment thread, read and answered where it sits. Drop it on any spot to talk about that spot, rather than attaching the remark to whichever shape happens to be nearest.',
    filled: true,
    action: { type: 'shape', kind: 'comment-pin' },
    icon: (
      <Glyph size={18} units={24}>
        <path d="M20.5 12.2c0 3.9-3.8 7-8.5 7-.9 0-1.8-.1-2.6-.3l-5 3.1 1.1-4.5A6.6 6.6 0 0 1 3.5 12.2c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z" />
        <path d="M8.6 11.9h.01M12 11.9h.01M15.4 11.9h.01" />
      </Glyph>
    ),
  },
  {
    // Action panel (docs/specs/012-collaboration/action-panel.md): one assigned action as a card on the canvas, the
    // Comment panel's sibling.
    id: 'collab:action-card',
    blurb: 'Assigned actions as a card on the canvas',
    caption: 'Action',
    section: 'tools',
    toolGroup: 'behaviour',
    tileGroup: 'record',
    label: 'Add Action Panel',
    description:
      'A card that carries a list of assigned actions: what needs doing, who owns each, and whether it is done. Set it up from the card, and join it to what it is about with an arrow.',
    filled: true,
    action: { type: 'shape', kind: 'action-card' },
    icon: (
      <Glyph size={18} units={24}>
        <path d="M9 4.5H7a1.5 1.5 0 0 0-1.5 1.5v13.5A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 17 4.5h-2" />
        <rect x="9" y="3" width="6" height="3.5" rx="1" />
        <path d="m9 13.5 2.2 2.2 4-4.5" />
      </Glyph>
    ),
  },
  {
    // Quiz (docs/specs/012-collaboration/quiz.md): one question with a right answer, opened on a timer and
    // revealed by the facilitator. In Ask, beside the poll and the estimate,
    // because it is putting a question to the room.
    id: 'collab:quiz',
    tileGroup: 'ask',
    blurb: 'A timed question with a right answer',
    caption: 'Quiz',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Quiz',
    description:
      'One multiple-choice question for the room. Start it and the answers fan out around the question for everyone to pick; it locks when the time runs out, then Reveal turns the right answer green and names who got it.',
    filled: true,
    action: { type: 'shape', kind: 'quiz' },
    icon: (
      <Glyph size={18} units={24}>
        {/* A disc with a question mark, answers around it. */}
        <circle cx="12" cy="12" r="4.6" />
        <path d="M10.7 10.9a1.4 1.4 0 1 1 1.9 1.3c-.4.2-.6.5-.6.9" />
        <circle cx="12" cy="14.5" r=".35" />
        <circle cx="12" cy="2.8" r="1.4" />
        <circle cx="21.2" cy="12" r="1.4" />
        <circle cx="12" cy="21.2" r="1.4" />
        <circle cx="2.8" cy="12" r="1.4" />
      </Glyph>
    ),
  },
  {
    // Estimate card (docs/specs/012-collaboration/estimate-card.md): ONE tile. The three scales are the same
    // card with different answers, so they are one entry here, and a new card
    // asks for its scale on the canvas ("Choosing a scale"); the element
    // menu's Scale changes it later.
    id: 'collab:estimate',
    tileGroup: 'ask',
    blurb: 'Planning poker: pick a scale on the card',
    caption: 'Estimate',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Estimate Card',
    description:
      'Planning poker on the canvas: everyone picks privately, then one Reveal shows every answer and the spread. Choose Fibonacci, T-shirt sizes or powers of two on the card once it is placed.',
    filled: true,
    action: { type: 'shape', kind: 'estimate' },
    icon: <EstimateIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'collab:temperature',
    tileGroup: 'ask',
    blurb: 'Fist of five: how does the room feel?',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Temperature Check',
    caption: 'Temperature',
    description:
      'A fist-of-five gauge. Everyone registers 1 to 5 and the bars and average move as the answers land.',
    filled: true,
    action: { type: 'shape', kind: 'temperature' },
    icon: <TemperatureIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'collab:idea-box',
    tileGroup: 'ask',
    blurb: 'Anonymous ideas, held until you open it',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Idea Box',
    caption: 'Idea Box',
    description:
      'Anyone can drop in an idea without their name on it. Nothing shows until you open the box.',
    filled: true,
    action: { type: 'shape', kind: 'idea-box' },
    icon: <IdeaBoxIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'collab:qa-board',
    tileGroup: 'ask',
    blurb: 'Notes the room upvotes, best on top',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Q&A Board',
    caption: 'Q&A Board',
    description:
      'Anyone can add a note, named or anonymous, and upvote others. The most wanted rise to the top; the facilitator spotlights one to discuss.',
    filled: true,
    action: { type: 'shape', kind: 'qa-board' },
    icon: <QaBoardIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'collab:agenda',
    tileGroup: 'record',
    blurb: 'Segments with minutes that start the timer',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Agenda',
    caption: 'Agenda',
    description:
      'The run of the session. Press a segment and it starts the tab timer for that long and marks where the room is.',
    filled: true,
    action: { type: 'shape', kind: 'agenda' },
    icon: <AgendaIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'collab:decision',
    tileGroup: 'record',
    blurb: 'What was decided, why, and whether it stands',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Decision Record',
    caption: 'Decision Record',
    description:
      'A decision on the canvas beside the thing it decided: the statement, a status, the date, and what drove it.',
    filled: true,
    action: { type: 'shape', kind: 'decision' },
    icon: <DecisionIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'collab:roll-call',
    tileGroup: 'record',
    blurb: 'Freezes who was in the room, right now',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Roll Call',
    caption: 'Roll Call',
    description:
      'Press Take Roll and it records everyone in the room at that moment, and keeps them after they leave.',
    filled: true,
    action: { type: 'shape', kind: 'roll-call' },
    icon: <RollCallIcon size={TILE_GLYPH_PX} />,
  },
];
