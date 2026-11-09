// Who may hear whom, as the server sees it (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Trust"; blueprint
// "Behaviour and state (server checks)"): the room's answer to the mint route before a subscription, and to a
// let-speak before it is delivered (#483, #495). Pure over what the room knows: everyone's last shared position, their
// stamped level, the hands let speak, and each tab's rooms and stages as last saved. Conservative on purpose: the
// positions lag the screen, so every edge and the open floor's reach carry a margin, and a false refusal heals on the
// call's retry.
import {
  CALL_RELEASE_RADIUS_PX,
  mayTakeStage,
  stageAt,
  zoneAt,
  type CallLevel,
  type CallPoint,
  type CallStage,
  type CallZone,
} from '@livehuddle/document';

/** How far beyond the release radius the open floor is allowed: positions lag by a step or two of walking. */
export const HEARING_MARGIN_PX = 160;
/** How far either side of a wall or a stage's edge a person may be counted on the other side. */
export const EDGE_MARGIN_PX = 64;

/** Where a walker last said they stand: the tab and their feet. */
export type Placed = { readonly tabId: string; readonly at: CallPoint };

/** A tab's calls: its visible rooms and stages. */
export type TabCalls = {
  readonly zones: readonly CallZone[];
  readonly stages: readonly CallStage[];
};

export type HearingWorld = {
  // Presence id → last shared position.
  readonly placed: ReadonlyMap<string, Placed>;
  // Presence id → the level the room stamped from its grant.
  readonly levels: ReadonlyMap<string, CallLevel>;
  // A hand's owner → who let it speak (delivered by the room, still raised): their presence id then, and their key.
  readonly letBy: ReadonlyMap<string, Letter>;
  // Presence id → the roster key its session claimed (the same person across a reconnect).
  readonly keys: ReadonlyMap<string, string>;
  // A tab's rooms and stages.
  readonly tab: (tabId: string) => TabCalls;
  // The room has just started and may not know everyone's position yet: an unknown one is allowed.
  readonly grace: boolean;
};

/** Who let a hand speak: their presence id when they did, and their roster key (the person), when they had one. */
export type Letter = { readonly id: string; readonly key: string | null };

/** `heard`: subscribe. `unplaced`: the room does not know where one of them is. `apart`: out of earshot or tab. */
export type HearingVerdict = 'heard' | 'unplaced' | 'apart';

const OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

// Where someone at `at` may really stand: there, and EDGE_MARGIN_PX away in eight directions.
function near(at: CallPoint): CallPoint[] {
  return OFFSETS.map(([dx, dy]) => ({
    x: at.x + dx * EDGE_MARGIN_PX,
    y: at.y + dy * EDGE_MARGIN_PX,
    // The seat goes with the feet: a Phone Booth's call is only its sitter's.
    seatedOn: at.seatedOn ?? null,
  }));
}

// Every room's call (null: the open floor) someone at `at` may be in.
function possibleZones(at: CallPoint, zones: readonly CallZone[]): Set<string | null> {
  const out = new Set<string | null>();
  for (const p of near(at)) out.add(zoneAt(p, zones));
  return out;
}

/** Whether `id` speaks from a stage: standing (within the margin) on one that lets their level speak. */
export function speaksFromStage(world: HearingWorld, id: string): boolean {
  const placed = world.placed.get(id);
  if (!placed) return false;
  const { stages } = world.tab(placed.tabId);
  if (stages.length === 0) return false;
  const level = world.levels.get(id);
  return near(placed.at).some((p) => {
    const s = stageAt(p, stages);
    return !!s && mayTakeStage(level, s.speakers);
  });
}

/** Whether `id` may let a raised hand speak now: an Editor anywhere, or someone speaking from a stage. */
export function mayLetSpeakNow(world: HearingWorld, id: string): boolean {
  return world.levels.get(id) === 'edit' || speaksFromStage(world, id);
}

/**
 * Whether whoever let a hand speak still may, following the person: their presence id passes `mayLetSpeakNow`, or
 * (once it does not, as after their reconnect) another session with their key does. A key is claimed, but this adds
 * no reach: the session it finds must itself be one the room would take a let-speak from.
 */
export function letterMayNow(world: HearingWorld, letter: Letter): boolean {
  if (mayLetSpeakNow(world, letter.id)) return true;
  if (letter.key === null) return false;
  for (const [id, key] of world.keys) {
    if (key === letter.key && id !== letter.id && mayLetSpeakNow(world, id)) return true;
  }
  return false;
}

/** Whether `subscriber` may receive `publisher`'s media now. */
export function hearingVerdict(
  world: HearingWorld,
  subscriber: string,
  publisher: string,
): HearingVerdict {
  const s = world.placed.get(subscriber);
  const p = world.placed.get(publisher);
  if (!s || !p) return world.grace ? 'heard' : 'unplaced';
  if (s.tabId !== p.tabId) return 'apart';
  // A stage reaches the whole tab, and so does a hand let speak by someone who still may.
  if (speaksFromStage(world, publisher)) return 'heard';
  const letter = world.letBy.get(publisher);
  if (letter !== undefined && letterMayNow(world, letter)) return 'heard';
  const { zones } = world.tab(s.tabId);
  const theirs = possibleZones(p.at, zones);
  for (const zone of possibleZones(s.at, zones)) {
    if (!theirs.has(zone)) continue;
    // A shared room, like the open floor, hears by distance; the walls between rooms block it.
    const d = Math.hypot(s.at.x - p.at.x, s.at.y - p.at.y);
    if (d <= CALL_RELEASE_RADIUS_PX + HEARING_MARGIN_PX) return 'heard';
  }
  return 'apart';
}
