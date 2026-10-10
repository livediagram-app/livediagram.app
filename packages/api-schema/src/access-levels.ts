// Access levels (docs/specs/013-workspace/share-roles.md): what a share link or embed admits. The levels are a
// ladder, every level holding everything below it; ownership is not a level.

export const ACCESS_LEVELS = ['view', 'participate', 'edit'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

// An omitted role on `POST /share` is edit, as it always was.
export const DEFAULT_LINK_LEVEL: AccessLevel = 'edit';
// The MCP's share_document makes a Participant link when the agent names no level.
export const DEFAULT_MCP_SHARE_LEVEL: AccessLevel = 'participate';
// The Share dialog's card order, most capable first.
export const LEVEL_ORDER: readonly AccessLevel[] = ['edit', 'participate', 'view'];

export function isAccessLevel(value: unknown): value is AccessLevel {
  return (ACCESS_LEVELS as readonly unknown[]).includes(value);
}

// Every reader of a stored or received level goes through this: an unknown value reads as the lowest level, so a
// level this code does not know never escalates anyone.
export function parseStoredLevel(value: unknown): AccessLevel {
  return isAccessLevel(value) ? value : 'view';
}

export function levelAtLeast(level: AccessLevel, min: AccessLevel): boolean {
  return ACCESS_LEVELS.indexOf(level) >= ACCESS_LEVELS.indexOf(min);
}

// The lower of two levels; no ceiling gives the level.
export function lowerLevel(level: AccessLevel, ceiling?: AccessLevel | null): AccessLevel {
  if (ceiling === undefined || ceiling === null) return level;
  return levelAtLeast(level, ceiling) ? ceiling : level;
}

// `POST /api/documents/:id/room-ticket`'s answer. A Participant's carries its own adder key, the id the room
// stamps on what it adds, so its editor knows which stickies are its own.
export type RoomTicketResponse = { ticket: string; adderKey?: string };

// The anonymous-events type each level is counted under (docs/specs/017-telemetry/telemetry.md).
export const LEVEL_TELEMETRY_TYPE: Record<AccessLevel, 'View' | 'Participate' | 'Edit'> = {
  view: 'View',
  participate: 'Participate',
  edit: 'Edit',
};
