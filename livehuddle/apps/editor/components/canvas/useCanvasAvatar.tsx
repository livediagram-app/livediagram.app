'use client';

import { answerMachine } from '@/lib/machine-answer';
import { useAvatarStatus } from '@liveworkspace/avatar/hooks/useAvatarStatus';
import { useByValue } from '@/hooks/ui/useByValue';
import { sameSitters, sittersByChair } from '@liveworkspace/avatar/chair-sitters';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_BUTTON_MODE,
  isBoxed,
  type ShapeElement,
  visibleLayerElements,
} from '@livehuddle/document';
import { track } from '@/lib/telemetry';
import { useAvatarSpeech } from '@liveworkspace/avatar/hooks/useAvatarSpeech';
import { useSpeechBubbles } from '@liveworkspace/avatar/speech-store';
import { avatarScale } from '@liveworkspace/avatar/config';
import { useAvatarActionKeys } from '@liveworkspace/avatar/hooks/useAvatarActionKeys';
import { useAvatarWalk } from '@liveworkspace/avatar/hooks/useAvatarWalk';
import { useAvatarPadArrivals } from '@liveworkspace/avatar/hooks/useAvatarPadArrivals';
import { avatarSpawnFromButton, type AvatarPoint } from '@liveworkspace/avatar/walk';
import {
  CHAIR_SITTER_FACING,
  isSeatingShape,
  nearestSeat,
  drinkFrom,
  seatingFacing,
} from '@livehuddle/document';
import { useAvatarConfig } from '@liveworkspace/avatar/hooks/useAvatarConfig';
import type { Reaction } from '@livehuddle/document';
import { usePortalTravel } from '@/components/canvas/portal-travel';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { loadAvatarSpeechLayer } from '@/lib/editor-deferred-code';
import { bindAvatar } from '@/lib/avatar-bindings';

// This editor's facts for Avatar mode (lib/avatar-bindings.ts), before any of it renders: every avatar view and
// hook is reached through the canvas, which loads this module first.
bindAvatar();

type CanvasAvatarInput = {
  props: CanvasProps;
  canvasTool: CanvasProps['canvasTool'];
  elements: CanvasProps['elements'];
  tabLayers: CanvasProps['tabLayers'];
  mainRef: CanvasProps['mainRef'];
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  viewportOffset: { x: number; y: number };
  viewportZoom: number;
  setViewportOffset: CanvasProps['setViewportOffset'];
  readZoom: () => number;
};

// The canvas's avatar (docs/specs/008-canvas/avatar-mode.md): the walking character and its look, status and
// bursts, speech bubbles, the chairs it and every peer sit in, shoves from peers, what it stands on, and portal
// travel (docs/specs/009-elements/portal-element.md). Composed into Canvas, which draws what it returns.
export function useCanvasAvatar({
  props,
  canvasTool,
  elements,
  tabLayers,
  mainRef,
  wrapperRef,
  viewportOffset,
  viewportZoom,
  setViewportOffset,
  readZoom,
}: CanvasAvatarInput) {
  // Avatar mode (docs/specs/008-canvas/avatar-mode.md): the walking character's position / facing / step
  // frame, its click-to-walk entry point, and the camera follow. Owns its own
  // rAF loop, dormant unless the tool is active.
  // The character's gender / clothing / hair / size (docs/specs/008-canvas/avatar-mode.md), persisted per
  // browser. Owned here because both the sprite and the Avatar Panel (down in
  // CanvasChrome) read it, and it outlives any one walk.
  const avatarLook = useAvatarConfig({ active: canvasTool === 'avatar' });
  // Where the next entry into Avatar mode should place the character, when it
  // was entered by pressing a button on the canvas. Cleared once used, so a
  // later entry from the palette spawns at the viewport centre as before.
  const avatarSpawnRef = useRef<AvatarPoint | null>(null);
  const pressModeButton = (element: ShapeElement) => {
    // Feet just below the button, centred on it, and only for a press that enters the mode.
    const spawn = avatarSpawnFromButton(element, element.mode ?? DEFAULT_BUTTON_MODE, canvasTool);
    if (spawn) avatarSpawnRef.current = spawn;
    props.onPressModeButton?.(element);
  };
  // Declared before the hook that fills it: the walk hook's chair callback
  // needs `sitOn`, which the same hook returns (see enterPortalRef below for
  // the identical knot).
  // The burst the avatar panel has asked for, if any. Ephemeral exactly like
  // a pad's (docs/specs/009-elements/reaction-pad.md): nothing is stored and nothing is replayed.
  const [avatarBurst, setAvatarBurst] = useState<{ reaction: Reaction; seed: number } | null>(null);
  const avatarBurstSeq = useRef(0);
  // Your status in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Status"), cleared on leaving it.
  const [avatarStatus, setAvatarStatus] = useAvatarStatus(canvasTool === 'avatar');
  // A character walks among what is drawn: a hidden layer's fences, portals and seats are not there.
  const walkElements = useMemo(
    () => visibleLayerElements(elements, tabLayers),
    [elements, tabLayers],
  );
  const avatar = useAvatarWalk({
    active: canvasTool === 'avatar',
    config: avatarLook.config,
    status: avatarStatus,
    onToggleGender: avatarLook.toggleGender,
    elements: walkElements,
    mainRef,
    wrapperRef,
    viewportOffset,
    viewportZoom,
    setViewportOffset,
    spawnAtRef: avatarSpawnRef,
    onPresence: props.onAvatarPresence,
    // Walking the character into a portal travels through it (docs/specs/009-elements/portal-element.md) — the same
    // action the portal's own click fires.
    onWalkIntoPortal: (element) => enterPortalRef.current(element),
    // Chair (docs/specs/009-elements/chair.md): walking onto one sits the character down, snapped to
    // the seat point so it sits ON the chair rather than wherever it arrived.
    // A desk or a sofa does the same (docs/specs/009-elements/chair.md "Desk and sofa"): a sofa seats
    // the character on the cushion nearest where it walked in.
    onWalkIntoChair: (element, feet) => {
      if (!isSeatingShape(element.shape)) return;
      const seating = { ...element, shape: element.shape };
      // A meeting table's seats each face the table (docs/specs/009-elements/office.md "Meeting Table").
      const seat = nearestSeat(seating, feet);
      avatarRef.current?.sitOn(
        element.id,
        seat,
        seat.facing ?? CHAIR_SITTER_FACING[seatingFacing(seating)],
      );
    },
    // A water cooler or a coffee machine (docs/specs/009-elements/office.md "Using it"): a drink in the hand,
    // and the machine answers on your screen.
    onWalkIntoDrink: (element) => {
      const drink = drinkFrom(element.shape);
      if (!drink) return;
      avatarRef.current?.giveDrink(drink);
      answerMachine(element.id);
      track('Canvas', 'Used', drink === 'water' ? 'WaterCooler' : 'CoffeeMachine');
    },
    // Reaction pad (docs/specs/009-elements/reaction-pad.md): walking onto one is the same act as pressing
    // it, so it runs the same handler.
    onWalkIntoReactionPad: (element) => props.onFireReaction?.(element),
  });
  // A fresh seed each press, so pressing the same reaction twice replays rather than continuing.
  const playAvatarBurst = (reaction: Reaction) => {
    avatarBurstSeq.current += 1;
    setAvatarBurst({ reaction, seed: avatarBurstSeq.current });
  };
  // The panel's Behaviour and Reactions on the keyboard (docs/specs/008-canvas/avatar-mode.md "Keyboard actions").
  useAvatarActionKeys({
    active: canvasTool === 'avatar',
    onReaction: avatar.playReaction,
    onBurst: playAvatarBurst,
  });
  // `sitOn` is returned by the very hook whose callback needs it, so the call
  // goes through a ref — declared above, repointed here, read at arrival time.
  // Same shape as `enterPortalRef` below, for the same reason.
  const avatarRef = useLatest<ReturnType<typeof useAvatarWalk> | null>(avatar);
  // Speech bubbles (docs/specs/008-canvas/avatar-mode.md "Speech bubbles"): an Editor or a Participant says
  // something above their character's head; everyone on the tab sees it float away.
  const speech = useAvatarSpeech({
    active: canvasTool === 'avatar',
    // The session's own say (docs/specs/013-workspace/share-roles.md): an Editor or a Participant, never by
    // whether the canvas is read-only.
    canSpeak: !!props.takePart,
    feet: avatar.pos,
    scale: avatarScale(avatarLook.config.size),
    tabId: props.activeTabId ?? '',
    onSay: props.onAvatarSay,
  });
  const speechBubbles = useSpeechBubbles();
  // Arrival beams on an Avatar Pad (docs/specs/009-elements/avatar-pad.md "The arrival"), yours and every peer's.
  const padArrivals = useAvatarPadArrivals({
    self: avatar.pos,
    selfColor: props.selfParticipant.color,
    peers: props.remoteAvatars,
    elements: walkElements,
  });
  // The composer's code fetched as soon as someone who may speak is in the mode, so the first Enter finds it in and
  // the words typed straight after it land in its box, not on the editor's shortcuts.
  useEffect(() => {
    if (speech.speaking) void loadAvatarSpeechLayer();
  }, [speech.speaking]);

  // Who is sitting in each chair, from PRESENCE — never from the document. Our
  // own character plus every peer's, keyed by chair id, so a chair empties by
  // itself the moment its occupant leaves the mode, changes tab or drops off.
  // Kept by value: presence rebuilds the peers' list often (a join, a colour), and a new map would
  // render every element view for chairs nobody sits in.
  const chairSitters = useByValue(
    useMemo(
      () =>
        sittersByChair(
          avatar.seatedOn,
          props.selfParticipant.color,
          props.remoteAvatars.map((peer) => ({
            name: peer.name,
            color: peer.color,
            seatedOn: peer.avatar.seatedOn,
          })),
        ),
      [avatar.seatedOn, props.remoteAvatars, props.selfParticipant.color],
    ),
    sameSitters,
  );
  // Stable while nobody sits or stands, so the element views' memo holds
  // (docs/specs/008-canvas/canvas-performance.md); it changes exactly when a chair must re-render.
  const sittersOf = useCallback(
    (elementId: string) => chairSitters.get(elementId) ?? [],
    [chairSitters],
  );
  // Somebody pushed us (docs/specs/008-canvas/avatar-mode.md): slide along their direction, once per push.
  // Keyed on the sequence number, not the vector, so two identical shoves in a
  // row both land.
  const lastShoveRef = useRef<number | null>(null);
  // `avatar` is a fresh object every render; the shove is the trigger, so the
  // push itself is an effect event.
  const applyShove = useEffectEvent((dx: number, dy: number) => avatar.shove(dx, dy));
  useEffect(() => {
    const shove = props.avatarShove;
    if (!shove || shove.seq === lastShoveRef.current) return;
    lastShoveRef.current = shove.seq;
    applyShove(shove.dx, shove.dy);
  }, [props.avatarShove]);

  // Bounds of whatever the avatar is standing on, for its "you are here" ring.
  const avatarStandingOn = useMemo(() => {
    if (!avatar.standingOnId) return null;
    const el = elements.find((e) => e.id === avatar.standingOnId);
    return el && isBoxed(el) ? { x: el.x, y: el.y, width: el.width, height: el.height } : null;
  }, [avatar.standingOnId, elements]);
  const { enterPortal, resolvePortal } = usePortalTravel({
    elements,
    tabs: props.portalTabs,
    activeTabId: props.activeTabId,
    onFollowLink: props.onFollowLink,
    mainRef,
    readZoom,
    setViewportOffset,
    teleportTo: avatar.teleportTo,
  });
  // Portals (docs/specs/009-elements/portal-element.md): the camera centres on the paired portal and the walking
  // character steps out of it — see usePortalTravel.
  //
  // `enterPortal` needs the avatar hook (to place the character) and the hook
  // needs `enterPortal` (for the walk-in), so the callback goes through a ref:
  // declared here, repointed on every render, read at call time.
  const enterPortalRef = useLatest<(from: ShapeElement) => void>(enterPortal);
  return {
    avatar,
    avatarBurst,
    avatarLook,
    avatarStandingOn,
    avatarStatus,
    padArrivals,
    playAvatarBurst,
    pressModeButton,
    resolvePortal,
    setAvatarBurst,
    setAvatarStatus,
    sittersOf,
    speech,
    speechBubbles,
  };
}
