import { toggledDoor, type Element } from '@livehuddle/document';
import { track } from '@/lib/telemetry';

// Opening and closing a Door (docs/specs/009-elements/room-builder.md "Opening and closing"): the one function the
// Avatar-mode click policy calls once `isNextToDoor` says the character can reach it. A swing is an ordinary edit
// (one undo step, shared with the room like any field); an Editor swings any door, a Participant any unlocked one
// (its commit passes the participant rule, which lets `doorClosed` through and nothing else), a Viewer none.
export function useDoorToggle({
  elements,
  canSwing,
  blocked,
  commit,
}: {
  elements: readonly Element[];
  // `can.swingDoor` (lib/editor-capabilities.ts).
  canSwing: (el: Element) => boolean;
  // The session's edit guard (a locked or loading tab, a Viewer).
  blocked: boolean;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
}) {
  // Swings the door and says whether it did (false for no such door, not a door, or a role that may not).
  const toggleDoor = (doorId: string): boolean => {
    const door = elements.find((el) => el.id === doorId);
    if (blocked || !door || door.type !== 'shape' || door.shape !== 'door' || !canSwing(door))
      return false;
    commit((els) =>
      els.map((el) => (el.id === doorId && el.type === 'shape' ? toggledDoor(el) : el)),
    );
    track('Canvas', 'Used', 'Door');
    return true;
  };
  return { toggleDoor };
}
