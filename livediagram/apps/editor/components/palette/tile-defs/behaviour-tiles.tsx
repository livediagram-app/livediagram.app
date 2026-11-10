import { REACTION_EMOJI } from '@livediagram/document';
import {
  EraserIcon,
  FormatPainterIcon,
  IsometricIcon,
  LaserIcon,
  PanIcon,
  PickerIcon,
  SelectIcon,
  SpotlightIcon,
  SessionPollIcon,
  SessionVoteIcon,
  RevealIcon,
  StopwatchIcon,
  TimerIcon,
} from '@/components/palette/palette-icons';
import { Glyph } from '@livediagram/ui';
import { TILE_GLYPH_PX, type PaletteTileDef } from './types';

// The Behaviour tiles (mode buttons, the door, session tools and reactions): one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

export const BEHAVIOUR_TILES: PaletteTileDef[] = [
  // Selection Mode buttons (docs/specs/009-elements/mode-button.md): one tile per mode, grouped, so the
  // button lands pointed at the mode you wanted rather than at the default
  // you then have to change.
  {
    id: 'tools:mode-select',
    tileGroup: 'mode',
    blurb: 'The ordinary pointer',
    caption: 'Select',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Select Mode Button',
    description:
      'A button that switches whoever presses it into Select mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'select' },
    // The mode's OWN glyph, the one the canvas-tool popover shows for it
    // (buildCanvasToolOptions): eight identical pointers told the reader
    // nothing about which mode a row would hand out.
    icon: <SelectIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'tools:mode-pan',
    tileGroup: 'mode',
    blurb: 'Drag the canvas around',
    caption: 'Hand',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Hand Mode Button',
    description:
      'A button that switches whoever presses it into Hand mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'pan' },
    // The mode's OWN glyph, the one the canvas-tool popover shows for it
    // (buildCanvasToolOptions): eight identical pointers told the reader
    // nothing about which mode a row would hand out.
    icon: <PanIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'tools:mode-laser',
    tileGroup: 'mode',
    blurb: 'Point at things while you talk',
    caption: 'Laser',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Laser Mode Button',
    description:
      'A button that switches whoever presses it into Laser mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'laser' },
    // The mode's OWN glyph, the one the canvas-tool popover shows for it
    // (buildCanvasToolOptions): eight identical pointers told the reader
    // nothing about which mode a row would hand out.
    icon: <LaserIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'tools:mode-spotlight',
    tileGroup: 'mode',
    blurb: 'Dim everything but one patch',
    caption: 'Spotlight',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Spotlight Mode Button',
    description:
      'A button that switches whoever presses it into Spotlight mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'spotlight' },
    // The mode's OWN glyph, the one the canvas-tool popover shows for it
    // (buildCanvasToolOptions): eight identical pointers told the reader
    // nothing about which mode a row would hand out.
    icon: <SpotlightIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'tools:mode-eraser',
    tileGroup: 'mode',
    blurb: 'Rub things out by dragging',
    caption: 'Eraser',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Eraser Mode Button',
    description:
      'A button that switches whoever presses it into Eraser mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'eraser' },
    // The mode's OWN glyph, the one the canvas-tool popover shows for it
    // (buildCanvasToolOptions): eight identical pointers told the reader
    // nothing about which mode a row would hand out.
    icon: <EraserIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'tools:mode-format',
    tileGroup: 'mode',
    blurb: 'Copy one element\u2019s style onto others',
    caption: 'Format',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Format Mode Button',
    description:
      'A button that switches whoever presses it into Format mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'format' },
    // The mode's OWN glyph, the one the canvas-tool popover shows for it
    // (buildCanvasToolOptions): eight identical pointers told the reader
    // nothing about which mode a row would hand out.
    icon: <FormatPainterIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'tools:mode-isometric',
    tileGroup: 'mode',
    blurb: 'Tilt the canvas into 3D',
    caption: 'Isometric',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Isometric Mode Button',
    description:
      'A button that switches whoever presses it into Isometric mode. It changes the mode for that person only, and pressing it again hands them back the mode they were in.',
    filled: true,
    dividerAfter: true,
    action: { type: 'shape', kind: 'mode-button', mode: 'isometric' },
    // The mode's OWN glyph, the one the canvas-tool popover shows for it
    // (buildCanvasToolOptions): eight identical pointers told the reader
    // nothing about which mode a row would hand out.
    icon: <IsometricIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Portal (docs/specs/009-elements/portal-element.md): step in here, come out of the portal it is linked to.
    // The tile id keeps its original 'door' word: ids are stable, since palette layouts and
    // search address tiles by them.
    id: 'tools:door',
    tileGroup: 'move',
    blurb: 'Step through to its linked portal',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Portal',
    caption: 'Portal',
    description:
      'Click it and you come out of the portal it is linked to. Link a pair from the element menu.',
    filled: true,
    action: { type: 'shape', kind: 'portal' },
    icon: (
      <Glyph size={18} units={18}>
        {/* The standing oval ring, with the far side showing through it. */}
        <ellipse cx="9" cy="9" rx="4.6" ry="7" />
        <ellipse cx="9" cy="9" rx="2.1" ry="3.6" strokeWidth="1.1" opacity="0.6" />
      </Glyph>
    ),
  },
  {
    // Session button (docs/specs/012-collaboration/session-button.md): starts a timer / vote / poll for the ro  {
    // Session tools (docs/specs/012-collaboration/session-button.md): one tile per tool, grouped, rather than one
    // button you place and then reconfigure. The tools have nothing in common
    // at the moment of choosing — you know whether you want a countdown or a
    // vote before you reach for the palette.
    id: 'tools:session-timer',
    tileGroup: 'tools',
    blurb: 'A countdown everyone can see',
    caption: 'Timer',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Timer Button',
    description:
      'A button that starts a countdown for everyone in the room. Pressing it again pauses, and again continues. Set the minutes from its right-click menu.',
    filled: true,
    action: { type: 'shape', kind: 'session-button', session: 'timer' },
    icon: <TimerIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'tools:session-stopwatch',
    tileGroup: 'tools',
    blurb: 'Counts up from zero',
    caption: 'Stopwatch',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Stopwatch Button',
    description:
      'A button that starts a stopwatch for everyone in the room, counting up from zero. Pressing it again pauses, and again continues. Nothing to set: a stopwatch has no length.',
    filled: true,
    action: { type: 'shape', kind: 'session-button', session: 'stopwatch' },
    icon: <StopwatchIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'tools:session-vote',
    tileGroup: 'ask',
    blurb: 'Dot voting, a few dots each',
    caption: 'Dot Vote',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Dot Vote Button',
    description:
      'A button that starts a dot vote for everyone in the room: each person gets a few dots to place on whatever they think matters. Set how many from its right-click menu.',
    filled: true,
    action: { type: 'shape', kind: 'session-button', session: 'vote' },
    icon: <SessionVoteIcon />,
  },
  {
    id: 'tools:session-poll',
    tileGroup: 'ask',
    blurb: 'A question you write in advance',
    caption: 'Poll',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Poll Button',
    description:
      'A button that opens a poll you have written in advance, so the press asks the question rather than opening a composer. Write it from its right-click menu.',
    filled: true,
    action: { type: 'shape', kind: 'session-button', session: 'poll' },
    icon: <SessionPollIcon />,
  },
  {
    // Reveal zone (docs/specs/009-elements/reveal-zone.md): a cover you click to see what is underneath.
    id: 'tools:reveal',
    tileGroup: 'tools',
    blurb: 'Double-click to look underneath',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Reveal Zone',
    caption: 'Reveal',
    description:
      'A cover over part of the canvas. Double-click it to uncover it just for you, or reveal it for everyone from the menu.',
    filled: true,
    action: { type: 'shape', kind: 'reveal' },
    icon: <RevealIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Done check (docs/specs/012-collaboration/done-check.md): who has finished, live.
    id: 'tools:done-check',
    tileGroup: 'tools',
    blurb: 'Everyone marks themselves finished',
    caption: 'Done',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Done Check',
    description:
      'Everyone marks themselves done and the card shows who has and who has not, from whoever is actually in the room. It flashes when the last person finishes. Reset it for the next round from its own menu.',
    filled: true,
    action: { type: 'shape', kind: 'done-check' },
    icon: (
      <Glyph size={18} units={24}>
        {/* Two ticked rows over one still waiting. */}
        <path d="M3.2 7.2 4.6 8.6 7.4 5.8" />
        <path d="M3.2 13 4.6 14.4 7.4 11.6" />
        <circle cx="4.8" cy="19" r="1.5" />
        <path d="M10.5 7.2h10.3M10.5 13h10.3M10.5 19h6.4" />
      </Glyph>
    ),
  },
  {
    // Reaction pads (docs/specs/009-elements/reaction-pad.md): one tile per reaction, grouped, rather than one
    // pad you place and then switch. Which reaction you want is the whole
    // decision — a pad is not useful until it is the right one.
    id: 'tools:reaction-confetti',
    tileGroup: 'reaction',
    blurb: 'A result worth celebrating',
    caption: 'Confetti',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Confetti Pad',
    description:
      'Press it and confetti bursts up and falls for everyone in the room. A result worth celebrating.',
    filled: true,
    action: { type: 'shape', kind: 'reaction-pad', reaction: 'confetti' },
    icon: <span className="text-[15px] leading-none">{REACTION_EMOJI['confetti']}</span>,
  },
  {
    id: 'tools:reaction-sparkles',
    tileGroup: 'reaction',
    blurb: 'A good idea, nicely done',
    caption: 'Sparkles',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Sparkles Pad',
    description:
      'Press it and a slow twinkle around the pad for everyone in the room. A good idea, nicely done.',
    filled: true,
    action: { type: 'shape', kind: 'reaction-pad', reaction: 'sparkles' },
    icon: <span className="text-[15px] leading-none">{REACTION_EMOJI['sparkles']}</span>,
  },
  {
    id: 'tools:reaction-hearts',
    tileGroup: 'reaction',
    blurb: 'Warmth for a person, not a result',
    caption: 'Hearts',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Hearts Pad',
    description:
      'Press it and hearts rise and drift for everyone in the room. Warmth for a person, not a result.',
    filled: true,
    action: { type: 'shape', kind: 'reaction-pad', reaction: 'hearts' },
    icon: <span className="text-[15px] leading-none">{REACTION_EMOJI['hearts']}</span>,
  },
  {
    id: 'tools:reaction-applause',
    tileGroup: 'reaction',
    blurb: 'Thanks for the talk or the demo',
    caption: 'Applause',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Applause Pad',
    description:
      'Press it and rings of sound spread out for everyone in the room. Thanks for the talk or the demo.',
    filled: true,
    action: { type: 'shape', kind: 'reaction-pad', reaction: 'applause' },
    icon: <span className="text-[15px] leading-none">{REACTION_EMOJI['applause']}</span>,
  },
  {
    id: 'tools:reaction-fireworks',
    tileGroup: 'reaction',
    blurb: 'It shipped',
    caption: 'Fireworks',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Fireworks Pad',
    description:
      'Press it and shells burst one after another for everyone in the room. It shipped.',
    filled: true,
    action: { type: 'shape', kind: 'reaction-pad', reaction: 'fireworks' },
    icon: <span className="text-[15px] leading-none">{REACTION_EMOJI['fireworks']}</span>,
  },
  {
    // Picker (docs/specs/012-collaboration/picker.md): rolls a person or a written option.
    id: 'tools:picker',
    tileGroup: 'tools',
    blurb: 'Pick someone at random',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Picker',
    caption: 'Picker',
    description:
      'Press it to choose at random: one of the people in the room, or one of the options you write on it.',
    filled: true,
    action: { type: 'shape', kind: 'picker' },
    icon: <PickerIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Bring Focus (docs/specs/012-collaboration/bring-focus.md): Navigate, beside Portal and Chair, because all
    // three take somebody somewhere. This is the one that takes everybody.
    id: 'tools:focus-button',
    tileGroup: 'move',
    blurb: 'Ask everyone to look here',
    section: 'tools',
    toolGroup: 'behaviour',
    label: 'Add Bring Focus',
    caption: 'Bring Focus',
    description:
      'Bring Focus. Press it and everyone else in the room is offered a jump to it, on your tab.',
    filled: true,
    action: { type: 'shape', kind: 'focus-button' },
    icon: (
      <Glyph size={18} units={24} strokeLinejoin="miter">
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
        <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
      </Glyph>
    ),
  },
];
