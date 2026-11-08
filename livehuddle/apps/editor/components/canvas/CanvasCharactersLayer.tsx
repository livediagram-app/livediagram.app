'use client';

import dynamic from 'next/dynamic';
import { useViewportOf } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import type { View } from '@liveworkspace/workbench/lib/viewport-store';
import { AvatarWalker } from '@liveworkspace/avatar/components/AvatarWalker';
import { AvatarSelfWalker } from '@liveworkspace/avatar/components/AvatarSelfWalker';
import { AvatarPadArrivals } from '@liveworkspace/avatar/components/AvatarPadArrivals';
import { useAvatarPadArrivals } from '@liveworkspace/avatar/hooks/useAvatarPadArrivals';
import { useAvatarPose } from '@liveworkspace/avatar/hooks/useAvatarPose';
import { poseFeet } from '@liveworkspace/avatar/pose';
import { parseAvatarStatus } from '@liveworkspace/avatar/status';
import { isDrinkKind } from '@liveworkspace/avatar/office-geometry';
import { headPoint } from '@liveworkspace/avatar/speech';
import { avatarScale, parseAvatarConfig } from '@liveworkspace/avatar/config';
import { reactionPose } from '@liveworkspace/avatar/reactions';
import { ReactionBurst } from '@/components/canvas/ReactionBurst';
import { ReceptionistLayer } from './receptionist/ReceptionistLayer';
import { CallBubbles, useCallBubbleRects } from '@/components/calls/CallBubbles';
import { TalkingBars } from '@/components/calls/TalkingBars';
import { HearingRing } from '@/components/calls/HearingRing';
import { RaisedHands } from '@/components/calls/RaisedHands';
import { useCanvasCall } from '@/components/calls/useCanvasCall';
import { usePieceMoments } from '@/components/canvas/collab/usePieceMoments';
import { useSocialPieces } from '@/components/canvas/collab/useSocialPieces';
import { useWorkdayPieces } from '@/lib/office/useWorkdayPieces';
import { useTableGameScene } from '@/lib/table-games/useTableGameScene';
import { usePeerAvatarRows } from '@/hooks/collab/usePeerRows';
import { loadAvatarSpeechLayer } from '@/lib/editor-deferred-code';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useWayfindingPeople } from './wayfinding/useWayfindingPeople';
import type { useCanvasAvatar } from './useCanvasAvatar';

// Speech bubbles (docs/specs/008-canvas/avatar-mode.md "Speech bubbles") load the first time somebody speaks:
// nothing on the canvas needs them before then.
const AvatarSpeechLayer = dynamic(loadAvatarSpeechLayer, { ssr: false });

// The footprint a burst is scaled against when it comes from the avatar panel rather than a pad: roughly a character,
// so the particles read as thrown by a person rather than by whatever size of pad last set one off.
const AVATAR_BURST_PX = 120;

const wholeView = (v: View) => v;

type CanvasAvatar = ReturnType<typeof useCanvasAvatar>;

// Every character on the tab and what rides on them (docs/specs/008-canvas/canvas-performance.md "Walking renders the
// characters, not the canvas"; blueprint: avatar-pose-store.md): the only part of the canvas that follows a step,
// yours or a peer's. It subscribes to your feet and the peers' characters, runs what reacts to where everyone stands
// (proximity audio, the pieces you walk up to, the pad beams, the game seats, who is where), and draws the
// characters, the hearing ring, the talking bars, raised hands, call bubbles and speech bubbles. Inside the canvas's
// transformed wrapper, after the element layer, so the characters pan and zoom with the canvas and stand in front of
// what they walk over. Peers' characters draw whether or not you walk.
export function CanvasCharactersLayer({
  props,
  canvasAvatar,
  mainSize,
}: {
  props: CanvasProps;
  canvasAvatar: CanvasAvatar;
  mainSize: { width: number; height: number };
}) {
  const {
    avatar,
    avatarBurst,
    avatarLook,
    avatarStandingOn,
    avatarStatus,
    setAvatarBurst,
    sitsDown,
    speech,
    speechBubbles,
    walkElements,
    seatsOf,
    wayfinding,
  } = canvasAvatar;
  const { canvasTool } = props;
  const inMode = canvasTool === 'avatar';
  const remoteAvatars = usePeerAvatarRows(props.peers);
  // Your feet: null outside the mode. A hop, a wave or a reaction in place renders your character alone.
  const feet = useAvatarPose(avatar.poseStore, poseFeet);
  const { zoom: viewportZoom, offset: viewportOffset } = useViewportOf(wholeView);

  // The social pieces (docs/specs/009-elements/social-pieces.md): the jukebox whose area you stand in plays for you,
  // and the arcade machine you stand at asks for a coin.
  useSocialPieces({ active: inMode, feet, elements: walkElements });
  // Piece moments (docs/specs/009-elements/piece-moments.md): a tree, a pond or a fire you walk right up to now and
  // then plays a small moment, on your screen alone.
  usePieceMoments({ active: inMode, feet, elements: walkElements });
  // The workday pieces (docs/specs/009-elements/workday-pieces.md): the reception desk you stand at welcomes you.
  useWorkdayPieces({ active: inMode, feet, elements: walkElements });
  // Arrival beams on an Avatar Pad (docs/specs/009-elements/avatar-pad.md "The arrival"), yours and every peer's.
  const padArrivals = useAvatarPadArrivals({
    selfPlaced: avatar.placed,
    readSelf: avatar.readPos,
    selfColor: props.selfParticipant.color,
    peers: remoteAvatars,
    elements: walkElements,
  });
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
  // Who is where, for the Directory, the Signpost and the Team Photo Wall (docs/specs/009-elements/directory.md).
  useWayfindingPeople({
    store: wayfinding.store,
    activeTabId: props.activeTabId,
    elements: props.elements,
    self: props.selfParticipant,
    selfConfig: avatarLook.config,
    selfFeet: inMode ? feet : null,
    remoteAvatars,
    tabPresence: props.tabPresence,
  });
  const selfScale = avatarScale(avatarLook.config.size);
  // Proximity audio (docs/specs/012-collaboration/proximity-audio.md): the call and its equaliser.
  const call = useCanvasCall({
    props,
    remoteAvatars,
    canvasTool,
    avatar: {
      pos: feet,
      walkTo: avatar.walkTo,
      seatedOn: avatar.seatedOn,
      standUp: avatar.standUp,
    },
    avatarScale: selfScale,
    viewport: {
      offset: viewportOffset,
      zoom: viewportZoom,
      width: mainSize.width,
      height: mainSize.height,
    },
    doNotDisturb: avatarStatus === 'dnd',
  });
  // Where the camera and screen bubbles were laid out, so speech bubbles rise clear of them.
  const callBubbleRects = useCallBubbleRects();

  return (
    <>
      {/* Where people can hear you while you talk, on the floor under every character, unless Settings
        turned it off (docs/specs/012-collaboration/proximity-audio.md "Your hearing ring"). */}
      {props.settings.hearingRing !== false ? <HearingRing {...call.ring} /> : null}
      {remoteAvatars.map((peer) => (
        <AvatarWalker
          key={peer.id}
          pos={{ x: peer.avatar.x, y: peer.avatar.y }}
          facing={peer.avatar.facing}
          // Parsed, not trusted: an older peer omits the costume entirely and
          // a future one may send an option this build doesn't know.
          config={parseAvatarConfig(peer.avatar.config)}
          walking={peer.avatar.walking}
          stepFrame={peer.avatar.stepFrame}
          lift={peer.avatar.lift}
          wave={peer.avatar.wave}
          seated={sitsDown(peer.avatar.seatedOn)}
          // Parsed, not trusted: anything but a known drink draws an empty hand.
          holding={isDrinkKind(peer.avatar.holding) ? peer.avatar.holding : null}
          status={parseAvatarStatus(peer.avatar.status)}
          // Replayed locally from the kind + elapsed time in their packet, by
          // the same pure function the sender used (docs/specs/008-canvas/avatar-mode.md).
          pose={
            peer.avatar.reaction
              ? reactionPose(peer.avatar.reaction.kind, peer.avatar.reaction.elapsedMs)
              : null
          }
          shirt={peer.color}
          name={peer.name}
          standingOn={null}
          glideMs={peer.glideMs}
        />
      ))}
      {/* The Receptionist (docs/specs/008-canvas/receptionist.md): the host by the tab's Avatar Pad, drawn while you
        walk. Owns his own clock, so his frames redraw his layer alone. */}
      {inMode ? (
        <ReceptionistLayer
          active
          elements={props.elements}
          arrivals={padArrivals}
          self={feet}
          zoom={viewportZoom}
        />
      ) : null}
      {/* A reaction burst (docs/specs/008-canvas/avatar-mode.md "Reactions") thrown around the character,
        at its canvas point, so it pans and zooms with the canvas it is celebrating. */}
      {feet && avatarBurst ? (
        <div
          className="pointer-events-none absolute"
          style={{ left: feet.x, top: feet.y, width: 0, height: 0 }}
        >
          <ReactionBurst
            reaction={avatarBurst.reaction}
            seed={avatarBurst.seed}
            // The character's own footprint, so the burst is scaled to a
            // person rather than to whatever pad happened to throw it.
            width={AVATAR_BURST_PX}
            height={AVATAR_BURST_PX}
            onDone={() => setAvatarBurst(null)}
          />
        </div>
      ) : null}
      {/* Your character, subscribed to its whole pose: a hop or a wave in place renders it alone. */}
      <AvatarSelfWalker
        poseStore={avatar.poseStore}
        config={avatarLook.config}
        seated={sitsDown(avatar.seatedOn)}
        holding={avatar.holding}
        status={avatarStatus}
        shirt={props.selfParticipant.color}
        standingOn={avatarStandingOn}
      />
      {/* Who is talking, near and far (docs/specs/012-collaboration/proximity-audio.md "The talking equaliser"). */}
      <TalkingBars {...call.bars} />
      {/* Raised hands beside the heads, each a Let Speak for whoever may (meeting-rooms-and-stage.md). */}
      <RaisedHands {...call.hands} />
      {/* Camera and screen bubbles above the characters (docs/specs/012-collaboration/video-and-screen-bubbles.md). */}
      <CallBubbles {...call.bubbles} rectsRef={callBubbleRects} />
      {/* Arrival beams on an Avatar Pad (docs/specs/009-elements/avatar-pad.md), over the characters. */}
      <AvatarPadArrivals arrivals={padArrivals} />
      {/* Speech bubbles, in front of every character: yours and everyone's, and the composer above your
          own head while you type. */}
      {speechBubbles.length > 0 || speech.composerOpen ? (
        <AvatarSpeechLayer
          bubbles={speechBubbles}
          activeTabId={props.activeTabId ?? ''}
          zoom={viewportZoom}
          view={{
            offsetX: viewportOffset.x,
            width: mainSize.width,
            offsetY: viewportOffset.y,
            height: mainSize.height,
          }}
          peers={remoteAvatars}
          self={{ name: props.selfParticipant.name, colour: props.selfParticipant.color }}
          // Speech rises clear of camera and screen bubbles (video-and-screen-bubbles.md "Close together").
          obstacles={callBubbleRects}
          composer={
            speech.composerOpen && feet
              ? {
                  head: headPoint(feet, selfScale),
                  coolingDown: speech.coolingDown,
                  onSend: (text) => speech.send(text, 'composer'),
                  onCancel: speech.closeComposer,
                }
              : null
          }
        />
      ) : null}
    </>
  );
}
