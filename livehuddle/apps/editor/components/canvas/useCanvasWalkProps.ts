// The Canvas's walking props (docs/specs/008-canvas/avatar-mode.md): a character's presence, shove, say and voice,
// Doors, Bring Focus, the mode buttons and Avatar Pads, and travel between tabs without leaving Avatar mode, read
// from EditorContext. Split from EditorCanvasHost, which spreads them into the Canvas.
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { DEFAULT_BUTTON_MODE } from '@livehuddle/document';
import { PARTICIPANT_CANVAS_TOOLS } from '@/components/palette/palette-layouts';
import type { RoleGates } from '@/lib/editor-capabilities';

export function useCanvasWalkProps(
  gates: RoleGates,
): Pick<
  CanvasProps,
  | 'onAvatarPresence'
  | 'avatarPeers'
  | 'onAvatarPush'
  | 'onToggleDoor'
  | 'onAvatarSay'
  | 'onCallSignal'
  | 'avatarShove'
  | 'walkIn'
  | 'avatarAtRef'
  | 'walkToggle'
  | 'onPressFocusButton'
  | 'onExitAvatarMode'
  | 'onPressAvatarPad'
  | 'onEnterAvatarMode'
  | 'tabPresence'
  | 'onTravelToTab'
  | 'onPressModeButton'
> {
  const {
    broadcastAvatar,
    broadcastAvatarPush,
    broadcastAvatarSay,
    toggleDoor,
    broadcastCallSignal,
    callsRoom,
    avatarShove,
    walkIn,
    avatarAtRef,
    pressFocusButton,
    canvasTool,
    participantsByTab,
    keepWalkingTo,
    embedMode,
    followLink,
    isReadOnly,
    can,
    livePresence,
    exitAvatarTool,
    pressModeButton,
  } = useEditorContext();
  return {
    onAvatarPresence: broadcastAvatar,
    // Who could see a character standing still: alone, its heartbeat rests (docs/specs/008-canvas/avatar-mode.md).
    avatarPeers: livePresence.length,
    // Avatar mode (docs/specs/008-canvas/avatar-mode.md): clicking a peer's character walks over and
    // shoves it; their own client decides what to do with the request.
    onAvatarPush: broadcastAvatarPush,
    // A walking click on a Door next to you swings it (docs/specs/008-canvas/avatar-mode.md "Clicking a piece").
    onToggleDoor: toggleDoor,
    onAvatarSay: broadcastAvatarSay,
    // Proximity audio (docs/specs/012-collaboration/proximity-audio.md): only with a room to talk in.
    onCallSignal: callsRoom ? broadcastCallSignal : undefined,
    avatarShove: avatarShove,
    walkIn: walkIn,
    avatarAtRef: avatarAtRef,
    // An Editor's alone: a Participant and a Viewer are always walking (docs/specs/013-workspace/share-roles.md
    // "Always walking").
    walkToggle: !embedMode && !can.alwaysWalks,
    // Bring Focus (docs/specs/012-collaboration/bring-focus.md) moves everyone's view, so it is running the
    // session: an Editor's (docs/specs/013-workspace/share-roles.md), and the facilitator's while somebody holds the
    // baton (docs/specs/012-collaboration/facilitator.md): "everybody look here" is the same act as "everybody
    // stop and listen". Undefined renders the face inert, which is what a
    // read-only surface already gets.
    onPressFocusButton: gates.run ? pressFocusButton : undefined,
    onExitAvatarMode: exitAvatarTool,
    // Mode button (docs/specs/009-elements/mode-button.md): pressing one is exactly picking that mode from
    // the palette, so it goes through the same setter, telemetry, the
    // selection clear, and the empty-canvas guard all included. Pressing it
    // again, while already in that mode, hands you back your previous one.
    // A read-only session presses only the modes it has (PARTICIPANT_CANVAS_TOOLS, docs/specs/013-workspace/share-roles.md).
    // Avatar Pad (docs/specs/009-elements/avatar-pad.md "Pressing it"): every role may walk, so a press is the
    // Avatar pick for anyone; the canvas has already told the walk which pad to start on.
    onPressAvatarPad: () => pressModeButton('avatar'),
    // The Directory's Walk There and a ride's arrival (docs/specs/009-elements/directory.md, elevator.md): the
    // Avatar pick for anyone, only when not already walking (the pick toggles).
    onEnterAvatarMode: () => {
      if (canvasTool !== 'avatar') pressModeButton('avatar');
    },
    tabPresence: participantsByTab,
    // Travel (a Portal, an Elevator, the Directory's Go) switches tab without ending Avatar mode
    // (docs/specs/008-canvas/avatar-mode.md "Changing tab").
    onTravelToTab: (tabId) => {
      keepWalkingTo(tabId);
      followLink({ kind: 'tab', tabId });
    },
    // A Participant's and a Viewer's buttons are inert faces: they are always walking, so none can switch them.
    onPressModeButton: can.alwaysWalks
      ? undefined
      : (element) => {
          const mode = element.mode ?? DEFAULT_BUTTON_MODE;
          if (isReadOnly && !PARTICIPANT_CANVAS_TOOLS.includes(mode)) return;
          pressModeButton(mode);
        },
  };
}
