// The named groups inside a Space category's flyout (docs/specs/010-palette/palette-top-level-categories.md "Groups
// in a flyout"): a category that mixes kinds of piece lists its groups here, in order, each with its name and its
// tiles by id. The meeting layout (palette-layouts) lays the tiles out with a divider between two groups, and the
// flyout (category-flyout-groups' GROUP_NAMES) heads each group with its name, keyed by its first tile.
//
// A piece of the category no group lists joins the last group, so a new piece still lands by its tileGroup alone.
// Pure data, no imports, so both readers can take it without a cycle.

export type SpaceCategoryGroup = { name: string; tiles: readonly string[] };

// Rooms opens on Build (palette-top-level-categories.md "Rooms opens on Build"): what a room is made with first.
const ROOMS_BUILD = [
  'tools:room',
  'tools:room-builder',
  'tools:corridor',
  'tools:wall-door',
] as const;

export const SPACE_CATEGORY_GROUPS: Readonly<Record<string, readonly SpaceCategoryGroup[]>> = {
  'collab-rooms': [
    { name: 'Build', tiles: ROOMS_BUILD },
    {
      name: 'Floor',
      tiles: [
        'tools:fence',
        'tools:stage',
        'tools:stage-curtains',
        'tools:podium',
        'tools:office-pod',
        // The workday pieces' rooms within the floor (docs/specs/009-elements/workday-pieces.md).
        'tools:phone-booth',
        'tools:nap-pod',
        'tools:reception-desk',
        'tools:rug',
        'tools:pillar',
        'tools:column',
      ],
    },
  ],
  // The bar first (the most furnished: a Rooftop Bar, a Cafe), then what people play, then what they sit by.
  'collab-recreation': [
    {
      name: 'Bar',
      tiles: ['tools:bar', 'tools:bar-stool', 'tools:drinks-cabinet', 'tools:drinks-fridge'],
    },
    {
      name: 'Games',
      tiles: [
        'tools:ping-pong-table',
        'tools:pool-table',
        'tools:foosball-table',
        'tools:arcade-machine',
        'tools:dartboard',
      ],
    },
    // A gym corner and the office dog (docs/specs/009-elements/workday-pieces.md "Where they live").
    { name: 'Gym', tiles: ['tools:treadmill', 'tools:weight-bench'] },
    { name: 'Lounge', tiles: ['tools:jukebox', 'tools:fireplace', 'tools:pet-bed'] },
  ],
  // Ground up: what grows, what is walked on and round, what is sat at, the water and fire, then the parking.
  'collab-garden': [
    { name: 'Plants', tiles: ['tools:outdoor-plant', 'tools:tree', 'tools:grass'] },
    { name: 'Paths and Fences', tiles: ['tools:garden-path', 'tools:garden-fence'] },
    {
      name: 'Furniture',
      tiles: ['tools:bench', 'tools:picnic-table', 'tools:hammock', 'tools:garden-umbrella'],
    },
    {
      name: 'Features',
      tiles: ['tools:fountain', 'tools:pond', 'tools:swimming-pool', 'tools:campfire'],
    },
    // Where people leave what they came in (docs/specs/009-elements/venue-pieces.md).
    { name: 'Parking', tiles: ['tools:car-park', 'tools:bike-rack'] },
  ],
};

/** Each group's name by its first tile, for the flyout's group headings. */
export const SPACE_GROUP_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.values(SPACE_CATEGORY_GROUPS).flatMap((groups) =>
    groups.flatMap((g) => (g.tiles[0] ? [[g.tiles[0], g.name] as const] : [])),
  ),
);

/** A category's tile ids in its groups' order, the groups split by `divide`; a piece no group lists joins the last
 *  group, and a listed id the category does not hold is skipped. Null for a category with no groups. */
export function groupedSpaceTiles(
  categoryId: string,
  own: readonly string[],
  divide: string,
): string[] | null {
  const groups = SPACE_CATEGORY_GROUPS[categoryId];
  if (!groups?.length) return null;
  const runs = groups.map((g) => g.tiles.filter((id) => own.includes(id)));
  const listed = new Set(runs.flat());
  runs.at(-1)!.push(...own.filter((id) => !listed.has(id)));
  return runs
    .filter((run) => run.length > 0)
    .flatMap((run, i, all) => (i < all.length - 1 ? [...run, divide] : run));
}
