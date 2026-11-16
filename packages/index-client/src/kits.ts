// Project kits (liveworkspace/docs/specs/004-index/kits.md): the catalogue, read by the site to show the kits and by
// the index to make them, so both always agree on what a kit holds; the run's wire shapes and their readers; and the
// role a part's pass takes when its app does not offer the one chosen.

import { APP_LINK_LEVELS, INDEX_ID_MAX, LEVELS, type App, type Level } from './constants';

export const KIT_IDS = [
  'software-project',
  'product-launch',
  'team-workshop',
  'website-build',
] as const;
export type KitId = (typeof KIT_IDS)[number];

// One item a kit makes: its key within the kit, its app, the app's template (the kind `/new?template=` takes) and
// its name, which follows the project's ("Apollo Plan").
export type KitPart = { slot: string; app: App; template: string; name: string };

export type Kit = { id: KitId; title: string; summary: string; parts: readonly KitPart[] };

// The most parts a kit has, and so the most items one run makes; every part is connected to every other both ways.
export const KIT_PARTS_MAX = 4;
// A project's name: it names the folder and starts every part's name, so it is held to an item title's length.
export const KIT_NAME_MAX = 60;
// The longest template kind a kit (or the apps' door) takes.
export const KIT_TEMPLATE_MAX = 100;

export const KITS: readonly Kit[] = [
  {
    id: 'software-project',
    title: 'Software Project',
    summary: 'Plan the work, draw the system, write the design and meet as a team.',
    parts: [
      { slot: 'plan', app: 'liveplanner', template: 'project-planner', name: 'Plan' },
      {
        slot: 'architecture',
        app: 'livediagram',
        template: 'system-architecture',
        name: 'Architecture',
      },
      { slot: 'design-doc', app: 'livedocuments', template: 'design-doc', name: 'Design Doc' },
      { slot: 'space', app: 'livehuddle', template: 'team-pod', name: 'Team Space' },
    ],
  },
  {
    id: 'product-launch',
    title: 'Product Launch',
    summary: 'Run the launch, tell its story, map the road ahead and gather everyone.',
    parts: [
      { slot: 'plan', app: 'liveplanner', template: 'product-launch', name: 'Launch Plan' },
      { slot: 'keynote', app: 'livedocuments', template: 'launch-keynote', name: 'Launch Keynote' },
      { slot: 'roadmap', app: 'livediagram', template: 'roadmap', name: 'Roadmap' },
      { slot: 'space', app: 'livehuddle', template: 'all-hands-hall', name: 'Launch Room' },
    ],
  },
  {
    id: 'team-workshop',
    title: 'Team Workshop',
    summary: 'Open with a deck, sort ideas together, look back and meet in one room.',
    parts: [
      { slot: 'deck', app: 'livedocuments', template: 'workshop-kickoff', name: 'Kick-off Deck' },
      { slot: 'affinity', app: 'livediagram', template: 'affinity-map', name: 'Affinity Map' },
      { slot: 'retro', app: 'liveplanner', template: 'team-retro', name: 'Retro Board' },
      { slot: 'space', app: 'livehuddle', template: 'training-room', name: 'Workshop Room' },
    ],
  },
  {
    id: 'website-build',
    title: 'Website Build',
    summary: 'Track the build, sketch every page and write the brief.',
    parts: [
      { slot: 'board', app: 'liveplanner', template: 'kanban', name: 'Build Board' },
      { slot: 'wireframes', app: 'livedesign', template: 'wireframe-website', name: 'Wireframes' },
      { slot: 'brief', app: 'livedocuments', template: 'article', name: 'Site Brief' },
    ],
  },
];

export const isKitId = (value: unknown): value is KitId =>
  typeof value === 'string' && (KIT_IDS as readonly string[]).includes(value);

export const kitById = (id: KitId): Kit => KITS.find((kit) => kit.id === id)!;

// The parts of every kit that one app makes, for the app's own catalogue test.
export const kitPartsOf = (app: App): KitPart[] =>
  KITS.flatMap((kit) => kit.parts.filter((part) => part.app === app));

// A part's name in a project: "<project> <part>".
export const kitPartTitle = (project: string, part: KitPart): string => `${project} ${part.name}`;

// The role a part's pass gives: the one chosen when its app offers it, else the nearest offered role below it, else
// the least it offers (livehuddle has no Viewer, so a Viewer kit's Space opens to Participants).
export function kitPassLevel(app: App, level: Level): Level {
  const offered = APP_LINK_LEVELS[app];
  if (offered.includes(level)) return level;
  const below = LEVELS.slice(0, LEVELS.indexOf(level)).reverse();
  return below.find((l) => offered.includes(l)) ?? LEVELS.find((l) => offered.includes(l))!;
}

// ---------- The run on the wire ---------------------------------------------------------------------------------

// `POST /kits`: a kit to start, or (with `folderId` and `made`) to finish, at a role, under a project name.
export type KitStartInput = {
  kit: KitId;
  level: Level;
  name: string;
  // A retry's: the folder the first run made, and what it made, by slot.
  folderId?: string;
  made?: Record<string, string>;
};

// One part as the run left it: its item, or null when it could not be made.
export type KitPartState = { slot: string; app: App; itemId: string | null };

export type KitRun = {
  folderId: string;
  parts: KitPartState[];
  // The connections among the made parts this run made, and those it could not.
  connections: { made: number; failed: number };
  // Every part made and every connection standing.
  complete: boolean;
};

// `POST /kits/remove`: everything a run made, deleted for good, and its folder when nothing else is in it.
export type KitRemoveInput = { folderId: string; made: Record<string, string> };

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= INDEX_ID_MAX;

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

// A run's made items, by slot: only the kit's slots, each an id; anything else refuses the body.
function readMade(value: unknown, slots: readonly string[]): Record<string, string> | null {
  if (!isObject(value)) return null;
  const made: Record<string, string> = {};
  for (const [slot, id] of Object.entries(value)) {
    if (!slots.includes(slot) || !isId(id)) return null;
    made[slot] = id;
  }
  return made;
}

export function readKitStartInput(value: unknown): KitStartInput | null {
  if (!isObject(value) || !isKitId(value.kit)) return null;
  const level = value.level;
  if (typeof level !== 'string' || !(LEVELS as readonly string[]).includes(level)) return null;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name || name.length > KIT_NAME_MAX) return null;
  const input: KitStartInput = { kit: value.kit, level: level as Level, name };
  if (value.folderId === undefined && value.made === undefined) return input;
  if (!isId(value.folderId)) return null;
  const made = readMade(
    value.made ?? {},
    kitById(value.kit).parts.map((p) => p.slot),
  );
  if (!made) return null;
  return { ...input, folderId: value.folderId, made };
}

export function readKitRemoveInput(value: unknown): KitRemoveInput | null {
  if (!isObject(value) || !isId(value.folderId)) return null;
  const slots = KITS.flatMap((kit) => kit.parts.map((p) => p.slot));
  const made = readMade(value.made, slots);
  if (!made || Object.keys(made).length > KIT_PARTS_MAX) return null;
  return { folderId: value.folderId, made };
}
