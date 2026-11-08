'use client';

import { answerMachine } from '@/lib/machine-answer';
import { usePieceMoments } from '@/components/canvas/collab/usePieceMoments';
import { useSocialPieces } from '@/components/canvas/collab/useSocialPieces';
import { useWorkdayPieces } from '@/lib/office/useWorkdayPieces';
import { useTableGameScene } from '@/lib/table-games/useTableGameScene';
import { isStandingSeatShape } from '@livehuddle/document';
import { useSeatStatus } from './useSeatStatus';
import { useByValue } from '@/hooks/ui/useByValue';
import type { AccessLevel } from '@livehuddle/api-schema';
import { speakingStageId } from './collab/speaking-stage';
import {
  sameSitters,
  seatedPeer,
  seatsOnBoard,
  sittersByChair,
} from '@liveworkspace/avatar/chair-sitters';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_BUTTON_MODE,
  callStages,
  isBoxed,
  roomZones,
  type ShapeElement,
} from '@livehuddle/document';
import { stageStanders } from '@/lib/calls/stage-presence';
import { track } from '@/lib/telemetry';
import { useAvatarSpeech } from '@liveworkspace/avatar/hooks/useAvatarSpeech';
import { useSpeechBubbles } from '@liveworkspace/avatar/speech-store';
import { avatarScale } from '@liveworkspace/avatar/config';
import { useAvatarActionKeys } from '@liveworkspace/avatar/hooks/useAvatarActionKeys';
import { useAvatarWalk } from '@liveworkspace/avatar/hooks/useAvatarWalk';
import { useAvatarPadArrivals } from '@liveworkspace/avatar/hooks/useAvatarPadArrivals';
import { avatarSpawnFromButton, type AvatarPoint } from '@liveworkspace/avatar/walk';
import { seatsACharacter, drinkFrom, type DrinkKind } from '@livehuddle/document';
import { closePods } from '@liveworkspace/avatar/pod';

// Which machine a drink came from, as the telemetry names it (docs/specs/009-elements/office.md "Telemetry").
const DRINK_TELEMETRY: Record<DrinkKind, string> = {
  water: 'WaterCooler',
  coffee: 'CoffeeMachine',
  juice: 'DrinksCabinet',
  soda: 'DrinksFridge',
};
import { seatOnArrival } from '@liveworkspace/avatar/seat-claims';
import { useSeatYield } from '@liveworkspace/avatar/hooks/useSeatYield';
import { useAvatarConfig } from '@liveworkspace/avatar/hooks/useAvatarConfig';
import type { Reaction } from '@livehuddle/document';
import { usePortalTravel } from '@/components/canvas/portal-travel';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { RemoteAvatarRow } from '@/lib/presence-rows';
import { useAssignRef, useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { loadAvatarSpeechLayer } from '@/lib/editor-deferred-code';
import { bindAvatar } from '@/lib/avatar-bindings';
import { useWalkIn } from './useWalkIn';
import { useWayfinding } from './wayfinding/useWayfinding';

// This editor's facts for Avatar mode (lib/avatar-bindings.ts), before any of it renders: every avatar view and
// hook is reached through the canvas, which loads this module first.
bindAvatar();

type CanvasAvatarInput = {
  props: CanvasProps;
  // Peers' characters on this tab, read from the peer-motion store by the canvas (hooks/collab/usePeerRows).
  remoteAvatars: RemoteAvatarRow[];
  canvasTool: CanvasProps['canvasTool'];
  elements: CanvasProps['elements'];
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
  remoteAvatars,
  canvasTool,
  elements,
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
  // browser. Owned here because both the sprite and the avatar palette (down in
  // CanvasChrome) read it, and it outlives any one walk.
  const avatarLook = useAvatarConfig({ active: canvasTool === 'avatar' });
  // Where the next entry into Avatar mode should place the character, when it
  // was entered by pressing a button on the canvas. Cleared once used, so a
  // later entry from the palette spawns at the viewport centre as before.
  const avatarSpawnRef = useRef<AvatarPoint | null>(null);
  // Opening walking from a Walk In button sets the same one-shot spot (docs/specs/008-canvas/avatar-mode.md
  // "Opening walking"); declared before the walk, whose entry reads it.
  useWalkIn({
    walkIn: props.walkIn,
    scale: avatarScale(avatarLook.config.size),
    spawnAtRef: avatarSpawnRef,
    mainRef,
    wrapperRef,
    viewportZoom,
    viewportOffset,
    setViewportOffset,
  });
  // Pressing an Avatar Pad (docs/specs/009-elements/avatar-pad.md "Pressing it") starts the walk on that pad.
  const avatarSpawnPadRef = useRef<string | null>(null);
  const pressAvatarPad = (element: ShapeElement) => {
    avatarSpawnPadRef.current = element.id;
    props.onPressAvatarPad?.(element);
  };
  const pressModeButton = (element: ShapeElement) => {
    // The whole figure just below the button, centred on it, and only for a press that enters the mode.
    const spawn = avatarSpawnFromButton(
      element,
      element.mode ?? DEFAULT_BUTTON_MODE,
      canvasTool,
      avatarScale(avatarLook.config.size),
    );
    if (spawn) avatarSpawnRef.current = spawn;
    props.onPressModeButton?.(element);
  };
  // Declared before the hook that fills it: the walk hook's chair callback
  // needs `sitOn`, which the same hook returns (see enterPortalRef below for
  // the identical knot).
  // The burst the avatar panel has asked for, if any (docs/specs/008-canvas/avatar-mode.md "Reactions").
  // Ephemeral: nothing is stored and nothing is replayed.
  const [avatarBurst, setAvatarBurst] = useState<{ reaction: Reaction; seed: number } | null>(null);
  const avatarBurstSeq = useRef(0);
  // A character walks among what is drawn.
  const walkElements = elements;
  // The seat you sat on as of the last render: the walk below returns it and takes the status it sets, so the status
  // reads it one render behind, caught up during render (never an effect) as soon as the walk reports a change.
  const [statusSeat, setStatusSeat] = useState<string | null>(null);
  // Your status in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Status"), cleared on leaving it, with the status a
  // seat piece sets laid over it while you sit there (docs/specs/009-elements/workday-pieces.md "Statuses a piece sets").
  const [avatarStatus, setAvatarStatus] = useSeatStatus(
    canvasTool === 'avatar',
    statusSeat,
    walkElements,
  );
  // The peers on this tab as the seat rules read them (docs/specs/009-elements/chair.md "Occupancy is presence"):
  // where they stand, what they sit on and their claim. Rebuilt only when presence changes.
  const seatPeers = useMemo(() => remoteAvatars.map((peer) => peer.avatar), [remoteAvatars]);
  // An Office Pod whose two seats peers hold has its door shut (docs/specs/009-elements/office.md "Office Pod"): the
  // walk's copy of the board says so, so its doorway blocks. The same array while no pod is full.
  // Keyed on who sits where, by value: presence flushes many times a second while anyone walks, and a new walk
  // scene each flush would rebuild the walls and the route grid while a pod is full.
  const seatedKey = useMemo(
    () =>
      seatPeers
        .flatMap((peer) => (peer.seatedOn ? [peer.seatedOn] : []))
        .sort()
        .join('\n'),
    [seatPeers],
  );
  const walkScene = useMemo(
    () =>
      closePods(
        walkElements,
        seatedKey ? seatedKey.split('\n').map((seatedOn) => ({ seatedOn })) : [],
      ),
    [walkElements, seatedKey],
  );
  const avatar = useAvatarWalk({
    active: canvasTool === 'avatar',
    // livehuddle's camera keeps the character in the middle (docs/specs/008-canvas/avatar-mode.md "The camera").
    camera: 'centred',
    config: avatarLook.config,
    status: avatarStatus,
    onToggleGender: avatarLook.toggleGender,
    elements: walkScene,
    mainRef,
    wrapperRef,
    viewportOffset,
    viewportZoom,
    setViewportOffset,
    spawnAtRef: avatarSpawnRef,
    spawnPadRef: avatarSpawnPadRef,
    onPresence: props.onAvatarPresence,
    peers: props.avatarPeers,
    // Walking the character into a portal travels through it (docs/specs/009-elements/portal-element.md) — the same
    // action the portal's own click fires.
    onWalkIntoPortal: (element) => enterPortalRef.current(element),
    // Chair (docs/specs/009-elements/chair.md): walking onto one sits the character down, snapped to
    // the seat point so it sits ON the chair rather than wherever it arrived.
    // A desk or a sofa does the same (docs/specs/009-elements/chair.md "Desk and sofa"): a sofa seats
    // the character on the free cushion nearest where it walked in.
    onWalkIntoChair: (element, feet) => {
      if (!seatsACharacter(element.shape)) return;
      // The nearest seat nobody holds, facing away from the back (a meeting table's seats each face the table,
      // docs/specs/009-elements/office.md "Meeting Table"); every seat taken stops us beside the piece
      // (docs/specs/009-elements/chair.md "Sitting").
      const arrival = seatOnArrival({ ...element, shape: element.shape }, feet, seatPeers);
      if ('stopAt' in arrival) avatarRef.current?.stepAside(arrival.stopAt);
      else avatarRef.current?.sitOn(element.id, arrival.sit, arrival.sit.facing, arrival.sit.index);
    },
    // A water cooler or a coffee machine (docs/specs/009-elements/office.md "Using it"): a drink in the hand,
    // and the machine answers on your screen.
    onWalkIntoDrink: (element) => {
      const drink = drinkFrom(element.shape);
      if (!drink) return;
      avatarRef.current?.giveDrink(drink);
      answerMachine(element.id);
      track('Canvas', 'Used', DRINK_TELEMETRY[drink]);
    },
  });
  // The social pieces (docs/specs/009-elements/social-pieces.md): the jukebox whose area you stand in plays for you,
  // and the arcade machine you stand at asks for a coin.
  useSocialPieces({ active: canvasTool === 'avatar', feet: avatar.pos, elements: walkElements });
  // Piece moments (docs/specs/009-elements/piece-moments.md): a tree, a pond or a fire you walk right up to now and
  // then plays a small moment, on your screen alone.
  usePieceMoments({ active: canvasTool === 'avatar', feet: avatar.pos, elements: walkElements });
  // The workday pieces (docs/specs/009-elements/workday-pieces.md): the reception desk you stand at welcomes you.
  useWorkdayPieces({ active: canvasTool === 'avatar', feet: avatar.pos, elements: walkElements });
  if (avatar.seatedOn !== statusSeat) setStatusSeat(avatar.seatedOn);
  // Who stands rather than sits in what they hold (workday-pieces.md "How each one walks"): the standing seats' ids,
  // once per board change, so drawing each character is one look-up.
  const standingSeats = useMemo(() => {
    const ids = new Set<string>();
    for (const el of walkElements)
      if (el.type === 'shape' && isStandingSeatShape(el.shape)) ids.add(el.id);
    return ids;
  }, [walkElements]);
  const sitsDown = useCallback(
    (seatedOn: string | null | undefined) => !!seatedOn && !standingSeats.has(seatedOn),
    [standingSeats],
  );
  // The editor's Fit, entry centring and zoom anchor read the character's live feet through this.
  const noAvatarAtRef = useRef<(() => AvatarPoint | null) | null>(null);
  useAssignRef(props.avatarAtRef ?? noAvatarAtRef, avatar.readPos);
  // A fresh seed each press, so pressing the same reaction twice replays rather than continuing.
  const playAvatarBurst = (reaction: Reaction) => {
    avatarBurstSeq.current += 1;
    setAvatarBurst({ reaction, seed: avatarBurstSeq.current });
    // A burst played, never which (docs/specs/008-canvas/avatar-mode.md "Telemetry").
    track('Canvas', 'Used', 'AvatarReaction');
  };
  // The palette's Actions and React on the keyboard (docs/specs/008-canvas/avatar-mode.md "Keyboard actions").
  useAvatarActionKeys({
    active: canvasTool === 'avatar',
    onReaction: avatar.playReaction,
    onBurst: playAvatarBurst,
  });
  // `sitOn` is returned by the very hook whose callback needs it, so the call
  // goes through a ref — declared above, repointed here, read at arrival time.
  // Same shape as `enterPortalRef` below, for the same reason.
  const avatarRef = useLatest<ReturnType<typeof useAvatarWalk> | null>(avatar);
  // Two people who sat on one seat at once: the later claim stands up beside it
  // (docs/specs/009-elements/chair.md "Occupancy is presence").
  useSeatYield({
    seatedOn: avatar.seatedOn,
    claim: avatar.seatClaim,
    elements: walkElements,
    peers: seatPeers,
    onYield: avatar.stepAside,
  });
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
    peers: remoteAvatars,
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
  // Stages show who stands on them the same way (docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage shows
  // who is on it"): merged in under the stage's id. Worked out on every step, but kept by value, so a stage re-renders
  // only when who is on it changes.
  const stages = useMemo(() => callStages(elements, roomZones(elements)), [elements]);
  // The stage you speak from, if any: its On Stage badge adds Everyone Can Hear You on your screen
  // (meeting-rooms-and-stage.md "You are told you are on it"). A string, so it changes only on and off a stage.
  const selfLevel: AccessLevel = props.canShareScreen
    ? 'edit'
    : props.takePart
      ? 'participate'
      : 'view';
  const speakingStage = speakingStageId(
    canvasTool === 'avatar' ? avatar.pos : null,
    stages,
    selfLevel,
  );
  // Each sitter on the seat they hold (docs/specs/009-elements/chair.md "Occupancy is presence"), so a sofa or a
  // table rings the exact seat, and at their drawn size, so the name pill clears the highest head.
  const seatsOf = useMemo(() => seatsOnBoard(walkElements), [walkElements]);
  // The game pieces (docs/specs/009-elements/social-pieces.md "A game"): who sits at each and may play, and the room.
  useTableGameScene({
    tabId: props.activeTabId ?? '',
    selfId: props.selfParticipant.id,
    selfColor: props.selfParticipant.color,
    seatedOn: avatar.seatedOn,
    seatClaim: avatar.seatClaim,
    takePart: !!props.takePart,
    peers: remoteAvatars,
    seatsOf,
    send: props.onCallSignal,
  });
  const selfScale = avatarScale(avatarLook.config.size);
  const chairSitters = useByValue(
    useMemo(() => {
      const byChair = sittersByChair(
        {
          name: 'You',
          color: props.selfParticipant.color,
          seatedOn: avatar.seatedOn,
          seat: avatar.seatClaim,
          scale: selfScale,
        },
        remoteAvatars.map((peer) => seatedPeer(peer)),
        seatsOf,
      );
      const onStage = stageStanders(
        stages,
        avatar.pos ? { at: avatar.pos, color: props.selfParticipant.color } : null,
        remoteAvatars.map((peer) => ({
          name: peer.name,
          color: peer.color,
          at: { x: peer.avatar.x, y: peer.avatar.y },
        })),
      );
      for (const [id, standers] of onStage) byChair.set(id, standers);
      return byChair;
    }, [
      avatar.seatedOn,
      avatar.seatClaim,
      selfScale,
      seatsOf,
      avatar.pos,
      stages,
      remoteAvatars,
      props.selfParticipant.color,
    ]),
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
    onTravelToTab: props.onTravelToTab,
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
  // The Directory and the Elevator (docs/specs/009-elements/directory.md, elevator.md): who is where, Walk There, Go
  // and rides, handed to their faces through the portal resolver the element layer already carries.
  const walking = canvasTool === 'avatar';
  const wayfinding = useWayfinding({
    walking,
    activeTabId: props.activeTabId,
    tabs: props.portalTabs,
    loadedTabIds: props.portalTabsLoaded,
    loadFloors: props.onLoadPortalTabs,
    elements,
    self: props.selfParticipant,
    selfConfig: avatarLook.config,
    remoteAvatars,
    tabPresence: props.tabPresence,
    avatar,
    enterWalking: () => {
      if (!walking) props.onEnterAvatarMode?.();
    },
    onFollowLink: props.onFollowLink,
    onTravelToTab: props.onTravelToTab,
    mainRef,
    readZoom,
    setViewportOffset,
  });
  const resolveFace = useCallback(
    (element: ShapeElement) =>
      // The Signpost and the Team Photo Wall (team-pieces.md) read the same store: the tab's places, who is here.
      element.shape === 'directory' ||
      element.shape === 'elevator' ||
      element.shape === 'stairs' ||
      element.shape === 'signpost' ||
      element.shape === 'photo-wall'
        ? { targetName: null, wayfinding }
        : resolvePortal(element),
    [resolvePortal, wayfinding],
  );
  return {
    avatar,
    avatarBurst,
    avatarLook,
    avatarStandingOn,
    avatarStatus,
    padArrivals,
    playAvatarBurst,
    pressModeButton,
    pressAvatarPad,
    resolvePortal: resolveFace,
    setAvatarBurst,
    setAvatarStatus,
    sittersOf,
    sitsDown,
    speakingStage,
    speech,
    speechBubbles,
  };
}
