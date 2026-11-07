'use client';

import type { ShapeElement } from '@livehuddle/document';
import { AvatarPadView } from '@/components/canvas/collab/AvatarPadView';
import { FenceView } from '@/components/canvas/collab/FenceView';
import {
  FurnitureView,
  isFurnitureViewShape,
  type ChairSitter,
} from '@/components/canvas/collab/FurnitureView';
import { GardenFenceView, GardenPathView, GrassView } from '@/components/canvas/collab/GardenViews';
import { DoorView } from '@/components/canvas/collab/RoomBuilderViews';
import { PondView } from '@/components/canvas/collab/PondView';
import { SwimmingPoolView } from '@/components/canvas/collab/SwimmingPoolView';
import { hasSocialFace, SocialFace } from '@/components/canvas/collab/SocialFaces';
import { hasWorkdayFace, WorkdayFace } from '@/components/canvas/collab/WorkdayFaces';
import { hasTeamFace, TeamFace } from '@/components/canvas/collab/TeamFaces';
import { RoomView } from '@/components/canvas/collab/RoomView';
import { RoomSignView } from '@/components/canvas/collab/RoomSignView';
import { ScreenView } from '@/components/canvas/collab/ScreenView';
import { StageView } from '@/components/canvas/collab/StageView';
import { TimerView } from '@/components/canvas/collab/TimerView';

const NO_SITTERS: ChairSitter[] = [];

// The pieces of a Space drawn as art (docs/specs/009-elements/office.md and its neighbours): the one place that
// says which view draws which kind, shared by the canvas (BoxedElementView) and the placement preview
// (docs/specs/010-palette/palette-drag-ghost.md "Placed pieces preview themselves"), so a preview is always the
// piece that lands. A new piece's art goes here.
export function hasPieceArt(kind: string): boolean {
  return (
    isFurnitureViewShape(kind) ||
    // The Pond (docs/specs/009-elements/social-pieces.md), drawn to its size.
    kind === 'pond' ||
    // The Swimming Pool (docs/specs/009-elements/venue-pieces.md), drawn to its size.
    kind === 'swimming-pool' ||
    kind === 'room' ||
    kind === 'door' ||
    kind === 'stage' ||
    kind === 'garden-path' ||
    kind === 'grass' ||
    kind === 'garden-fence' ||
    kind === 'fence' ||
    kind === 'avatar-pad' ||
    // The Screen and the Room Sign (docs/specs/009-elements/screen-and-room-sign.md): live faces drawn from the
    // call and presence; a preview (no snapshot yet) draws the idle Screen and a Free sign.
    kind === 'screen' ||
    kind === 'room-sign' ||
    // The Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md): their live clock and controls; a
    // preview draws the idle face with no buttons.
    kind === 'timer' ||
    kind === 'stopwatch'
  );
}

export function PieceArt({
  element,
  stroke,
  fill,
  animClass,
  sitters = NO_SITTERS,
  walking = false,
  onPressAvatarPad,
  live = false,
}: {
  element: ShapeElement;
  stroke: string;
  fill: string;
  animClass?: string;
  // Whoever presence says sits in a chair, desk or sofa (docs/specs/009-elements/chair.md), or stands on a stage
  // (docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage shows who is on it").
  sitters?: ChairSitter[];
  // The viewer is in Avatar mode: a reading piece's whole face opens it in the reader
  // (docs/specs/008-canvas/avatar-mode.md "The reader").
  walking?: boolean;
  // An Avatar Pad is pressable (docs/specs/009-elements/avatar-pad.md "Pressing it"); absent in a preview.
  onPressAvatarPad?: (element: ShapeElement) => void;
  // On the canvas, not a placement preview: a Timer or Stopwatch ticks, chimes and shows its controls.
  live?: boolean;
}) {
  const kind = element.shape;
  // A chair, a desk or a sofa (docs/specs/009-elements/chair.md "Facing"): the furniture itself, drawn for its
  // facing, plus whoever is sitting in it.
  if (isFurnitureViewShape(kind)) {
    const art = (
      <FurnitureView
        element={element}
        stroke={stroke}
        fill={fill}
        sitters={sitters}
        animClass={animClass}
      />
    );
    // A social piece's live face over its art (docs/specs/009-elements/social-pieces.md): the notice board's notes,
    // the world clock's dials, the jukebox's button, the arcade's bubble.
    if (hasSocialFace(kind))
      return (
        <>
          {art}
          <SocialFace element={element} walking={walking} />
        </>
      );
    // A team piece's face (docs/specs/009-elements/team-pieces.md): the calendar's month, the suggestion box's button.
    if (hasTeamFace(kind))
      return (
        <>
          {art}
          <TeamFace element={element} walking={walking} />
        </>
      );
    // A workday piece's face (docs/specs/009-elements/workday-pieces.md): the reception desk's Welcome, the office dog.
    if (hasWorkdayFace(kind))
      return (
        <>
          {art}
          <WorkdayFace element={element} />
        </>
      );
    return art;
  }
  switch (kind) {
    // A room (office.md "Room"): its floor, walls and doorway; its name is the ordinary label on the back wall.
    case 'room':
      return <RoomView element={element} stroke={stroke} floor={fill} animClass={animClass} />;
    // A Door (room-builder.md "Door"): a doorway turned onto its wall.
    case 'door':
      return <DoorView element={element} stroke={stroke} floor={fill} animClass={animClass} />;
    // A stage (office.md "Stage"): its top, front edge and plate; its name is the ordinary label on the plate.
    case 'stage':
      return (
        <StageView
          element={element}
          stroke={stroke}
          floor={fill}
          animClass={animClass}
          standers={sitters}
        />
      );
    // A garden path, grass and a garden fence (office.md), drawn to their size.
    case 'garden-path':
      return (
        <GardenPathView element={element} stroke={stroke} floor={fill} animClass={animClass} />
      );
    case 'pond':
      return <PondView element={element} stroke={stroke} floor={fill} animClass={animClass} />;
    case 'swimming-pool':
      return (
        <SwimmingPoolView element={element} stroke={stroke} floor={fill} animClass={animClass} />
      );
    case 'grass':
      return <GrassView element={element} floor={fill} animClass={animClass} />;
    case 'garden-fence':
      return <GardenFenceView element={element} stroke={stroke} animClass={animClass} />;
    // A fence (fence.md): posts and rails.
    case 'fence':
      return <FenceView element={element} stroke={stroke} animClass={animClass} />;
    // An Avatar Pad (avatar-pad.md): the teleport platform characters start on.
    case 'screen':
      return <ScreenView element={element} animClass={animClass} />;
    case 'room-sign':
      return <RoomSignView element={element} animClass={animClass} />;
    case 'timer':
    case 'stopwatch':
      return <TimerView element={element} live={live} />;
    case 'avatar-pad':
      return (
        <AvatarPadView
          stroke={stroke}
          animClass={animClass}
          onPress={onPressAvatarPad ? () => onPressAvatarPad(element) : undefined}
        />
      );
    default:
      return null;
  }
}
