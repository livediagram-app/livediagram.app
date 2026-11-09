// Retired elements (docs/specs/009-elements/retired-elements.md): the element kinds that moved to livehuddle with
// Spaces and Avatar mode (docs/specs/002-project-scope/not-in-livediagram.md). A document saved before the move keeps
// them exactly as stored; livediagram draws each as a placeholder and never makes a new one.
//
// A LEAF module (no runtime imports) so the validator, the factories and the editor can all ask it without a cycle.

// Every shape kind that is retired outright, in the order the placeholder names them.
export const RETIRED_SHAPE_KINDS = [
  'chair',
  'desk',
  'sofa',
  'fence',
  'avatar-pad',
  'room',
  'meeting-table',
  'plant',
  'bookshelf',
  'water-cooler',
  'coffee-machine',
  'rug',
] as const;

export type RetiredShapeKind = (typeof RETIRED_SHAPE_KINDS)[number];

const RETIRED_KIND_SET: ReadonlySet<string> = new Set(RETIRED_SHAPE_KINDS);

const RETIRED_NAMES: Record<RetiredShapeKind | 'mode-button', string> = {
  chair: 'Chair',
  desk: 'Desk',
  sofa: 'Sofa',
  fence: 'Fence',
  'avatar-pad': 'Avatar Pad',
  room: 'Room',
  'meeting-table': 'Meeting Table',
  plant: 'Plant',
  bookshelf: 'Bookshelf',
  'water-cooler': 'Water Cooler',
  'coffee-machine': 'Coffee Machine',
  rug: 'Rug',
  'mode-button': 'Avatar Button',
};

export function isRetiredShapeKind(kind: unknown): kind is RetiredShapeKind {
  return typeof kind === 'string' && RETIRED_KIND_SET.has(kind);
}

// The element as the question needs it: a structural type, so leaf callers need not import the Element union.
type MaybeRetired = { type: string; shape?: string; mode?: string };

/**
 * Is this element one livediagram keeps but no longer draws or makes? A retired shape kind, or a Selection Mode
 * button that hands out Avatar mode: stored as `mode: 'avatar'`, or with no mode at all (absent always meant the old
 * Avatar default, DEFAULT_BUTTON_MODE).
 */
export function isRetiredElement(el: MaybeRetired | null | undefined): boolean {
  if (!el || el.type !== 'shape') return false;
  if (isRetiredShapeKind(el.shape)) return true;
  return el.shape === 'mode-button' && (el.mode === undefined || el.mode === 'avatar');
}

/** The name a retired element's placeholder shows ("Water Cooler", "Avatar Button"), or null when it is not one. */
export function retiredElementName(el: MaybeRetired | null | undefined): string | null {
  if (!isRetiredElement(el)) return null;
  return RETIRED_NAMES[el!.shape as RetiredShapeKind | 'mode-button'];
}

// The retired kinds that turned by a stored facing (`chairFacing`) rather than the ordinary rotation, so a stored
// board keeps reading them upright exactly as before the move, and a read still names the field.
export const RETIRED_FACING_KINDS = [
  'chair',
  'desk',
  'sofa',
  'meeting-table',
  'plant',
  'bookshelf',
  'water-cooler',
  'coffee-machine',
  'rug',
] as const satisfies readonly RetiredShapeKind[];
const UPRIGHT_KINDS: ReadonlySet<string> = new Set(RETIRED_FACING_KINDS);
export function isUprightRetiredKind(kind: string): boolean {
  return UPRIGHT_KINDS.has(kind);
}

// The retired kinds that lay on the floor, under everything else in their layer, as they always did.
const FLOOR_KINDS: ReadonlySet<string> = new Set(['room', 'rug', 'avatar-pad']);
export function isRetiredFloorKind(kind: string): boolean {
  return FLOOR_KINDS.has(kind);
}

// The stored fields only retired kinds carry: kept and validated so a save writes them back unchanged.
export type ChairFacing = 'n' | 'e' | 's' | 'w';
export const CHAIR_FACINGS: readonly ChairFacing[] = ['n', 'e', 's', 'w'];
export function isChairFacing(value: unknown): value is ChairFacing {
  return (CHAIR_FACINGS as readonly unknown[]).includes(value);
}
export type RoomDoor = ChairFacing | 'none';
export const ROOM_DOORS: readonly RoomDoor[] = ['n', 'e', 's', 'w', 'none'];
export function isRoomDoor(value: unknown): value is RoomDoor {
  return (ROOM_DOORS as readonly unknown[]).includes(value);
}

// What the placeholder and every refusal say.
export const RETIRED_ELEMENT_LINE = 'Moved to livehuddle';
export const RETIRED_ELEMENT_HINT =
  'This piece lives in livehuddle now. It is kept here as saved; you can move or delete it.';

/** The refusal an agent's or the API's create gets when it names a retired kind. */
export function retiredKindRefusal(kind: RetiredShapeKind): string {
  return `${RETIRED_NAMES[kind]} moved to livehuddle and can no longer be added in livediagram.`;
}

/**
 * Why an agent or the API may not write this element as a new one (docs/specs/009-elements/retired-elements.md
 * "Nothing new"), or null. A retired shape kind, or a Selection Mode button set to Avatar mode. A button with no mode
 * is not refused here: whoever makes a new one gives it NEW_BUTTON_MODE.
 */
export function retiredCreateRefusal(el: MaybeRetired | null | undefined): string | null {
  if (!el || el.type !== 'shape') return null;
  if (isRetiredShapeKind(el.shape)) return retiredKindRefusal(el.shape);
  if (el.shape === 'mode-button' && el.mode === 'avatar')
    return 'Avatar mode moved to livehuddle, so a Selection Mode button can no longer hand it out in livediagram.';
  return null;
}
