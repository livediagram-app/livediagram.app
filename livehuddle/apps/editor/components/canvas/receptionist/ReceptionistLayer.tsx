'use client';

// The Receptionist on the canvas (docs/specs/008-canvas/receptionist.md): his character, drawn like everyone's, a press on him to
// Ask Receptionist, and his bubble over his head while it is open. Drawn inside the transformed layer with the characters,
// while you walk on a tab with an Avatar Pad. Owns its own clock (useReceptionist), so his frames redraw this layer alone.

import { useEffect } from 'react';
import type { Element } from '@livehuddle/document';
import type { PadArrival } from '@livehuddle/avatar/pad';
import type { AvatarPoint } from '@livehuddle/avatar/walk';
import { avatarScale } from '@livehuddle/avatar/config';
import { headPoint } from '@livehuddle/avatar/speech';
import { reactionPose } from '@livehuddle/avatar/reactions';
import { AvatarWalker } from '@livehuddle/avatar/components/AvatarWalker';
import {
  askReceptionist,
  closeReceptionist,
  sayReceptionistFarewell,
  setReceptionistHere,
  useReceptionistState,
} from '@/lib/receptionist/receptionist-store';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import { RECEPTIONIST_COLOUR, RECEPTIONIST_LOOK } from '@/lib/receptionist/receptionist-look';
import { RECEPTIONIST_TOPICS } from '@/lib/receptionist/receptionist-topics';
import { useReceptionist } from './useReceptionist';
import { ReceptionistBubble } from './ReceptionistBubble';
import { track } from '@/lib/telemetry';

// How long his farewell shows before he leaves the pad.
const FAREWELL_MS = 2_000;
// Walking away from him closes his bubble: your feet this far from his.
const TALK_REACH = 400;
// The box a press on him lands in, round his feet, in canvas px.
const PRESS_W = 40;
const PRESS_H = 84;
// His bubble's tail sits above his name tag, not on it: canvas px above his head point.
const OVER_NAME = 22;

export function ReceptionistLayer({
  active,
  elements,
  arrivals,
  self,
  zoom,
}: {
  active: boolean;
  elements: readonly Element[];
  arrivals: readonly PadArrival[];
  self: AvatarPoint | null;
  zoom: number;
}) {
  const receptionist = useReceptionist({ active, elements, arrivals, self });
  const { chat } = useReceptionistState();
  // Ask Receptionist to Leave is an Editor's (docs/specs/008-canvas/receptionist.md "Asking him to leave"): his
  // farewell, then the flag on his pad, synced to everyone and one undo step.
  const editor = useOptionalEditorContext();
  const setPadReceptionistOf =
    editor?.can.level === 'edit' ? (editor.setPadReceptionistOf ?? null) : null;
  const padId = receptionist?.world.padId ?? null;
  // From the press, not an effect: closing his bubble mid-farewell does not keep him.
  const leave =
    setPadReceptionistOf && padId
      ? () => {
          sayReceptionistFarewell();
          setTimeout(() => {
            setPadReceptionistOf(padId, false);
            closeReceptionist();
          }, FAREWELL_MS);
        }
      : undefined;
  const here = receptionist !== null;

  useEffect(() => {
    setReceptionistHere(here);
    return () => setReceptionistHere(false);
  }, [here]);

  // His bubble closes when you walk away from him, or press Escape (not while typing in a field).
  const pose = receptionist?.pose ?? null;
  // Not while he walks you to a room: then he goes ahead and you follow.
  const leading =
    chat.open &&
    chat.topicId !== null &&
    RECEPTIONIST_TOPICS.find((t) => t.id === chat.topicId)?.target === 'room';
  const far =
    chat.open &&
    !leading &&
    pose !== null &&
    self !== null &&
    !pose.walking &&
    // Not in the render an ask opens his bubble: he has not set off yet, and stands where his day had him.
    !receptionist?.setting &&
    Math.hypot(self.x - pose.at.x, self.y - pose.at.y) > TALK_REACH;
  useEffect(() => {
    if (far) closeReceptionist();
  }, [far]);
  useEffect(() => {
    if (!chat.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const t = e.target;
      if (t instanceof Element && t.closest('input, textarea, [contenteditable="true"]')) return;
      // His bubble takes the Escape, ahead of the canvas (which would leave Walk).
      e.preventDefault();
      e.stopImmediatePropagation();
      closeReceptionist();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [chat.open]);

  if (!receptionist || !pose) return null;
  const scale = avatarScale(RECEPTIONIST_LOOK.size);
  const top = headPoint(pose.at, scale);
  const head = { x: top.x, y: top.y - OVER_NAME * scale };
  return (
    <>
      <AvatarWalker
        pos={pose.at}
        facing={pose.facing}
        config={RECEPTIONIST_LOOK}
        walking={pose.walking}
        stepFrame={pose.stepFrame}
        holding={pose.holding}
        pose={pose.reaction ? reactionPose(pose.reaction.kind, pose.reaction.elapsedMs) : null}
        shirt={RECEPTIONIST_COLOUR}
        name="Receptionist"
        host
        standingOn={null}
      />
      <button
        type="button"
        aria-label="Ask Receptionist"
        data-receptionist=""
        className="pointer-events-auto absolute cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-amber-500"
        style={{
          left: pose.at.x - (PRESS_W * scale) / 2,
          top: pose.at.y - PRESS_H * scale,
          width: PRESS_W * scale,
          height: PRESS_H * scale,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          track('UI', 'Opened', 'AskReceptionist');
          askReceptionist();
        }}
      />
      {chat.open && !pose.walking ? (
        <ReceptionistBubble head={head} feet={pose.at} zoom={zoom} onLeave={leave} />
      ) : null}
    </>
  );
}
