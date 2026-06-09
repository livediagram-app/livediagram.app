// Curated single-colour icon catalogue for the "icon" shape kind
// (spec/09 "Icons" accordion). Each glyph is a small set of stroke
// primitives drawn in a 0..24 viewBox, rendered with the element's
// stroke colour (fill="none") so an icon tints + themes like a line
// drawing. The geometry is deliberately Feather / Lucide-flavoured:
// simple, recognisable, single-weight outlines.
//
// `iconId` on a ShapeElement keys into this catalogue. It is a plain
// string in the data model (NOT a closed enum) so adding an icon is a
// one-file change with no schema migration; an unknown id renders the
// PLACEHOLDER glyph rather than vanishing.

// DataTransfer MIME for dragging a palette icon onto a shape. Shared by
// the palette (drag source) and BoxedElementView (drop target) so the
// type string can't drift. Value carried = the icon id.
export const ICON_DND_MIME = 'application/x-livediagram-icon';

export type IconPrim =
  | { t: 'path'; d: string }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { t: 'polyline'; points: string }
  | { t: 'polygon'; points: string }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

export type IconDef = {
  id: string;
  label: string;
  // Extra search terms beyond the label, so "db" finds "database" and
  // "gear" finds "settings".
  keywords: string;
  prims: IconPrim[];
};

export const ICON_CATALOG: IconDef[] = [
  {
    id: 'user',
    label: 'User',
    keywords: 'person profile account avatar people',
    prims: [
      { t: 'path', d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' },
      { t: 'circle', cx: 12, cy: 7, r: 4 },
    ],
  },
  {
    id: 'users',
    label: 'Users',
    keywords: 'people team group members',
    prims: [
      { t: 'path', d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' },
      { t: 'circle', cx: 9, cy: 7, r: 4 },
      { t: 'path', d: 'M23 21v-2a4 4 0 0 0-3-3.87' },
      { t: 'path', d: 'M16 3.13a4 4 0 0 1 0 7.75' },
    ],
  },
  {
    id: 'server',
    label: 'Server',
    keywords: 'host backend rack infrastructure',
    prims: [
      { t: 'rect', x: 2, y: 2, w: 20, h: 8, rx: 2 },
      { t: 'rect', x: 2, y: 14, w: 20, h: 8, rx: 2 },
      { t: 'line', x1: 6, y1: 6, x2: 6.01, y2: 6 },
      { t: 'line', x1: 6, y1: 18, x2: 6.01, y2: 18 },
    ],
  },
  {
    id: 'database',
    label: 'Database',
    keywords: 'db storage sql data',
    prims: [
      { t: 'ellipse', cx: 12, cy: 5, rx: 9, ry: 3 },
      { t: 'path', d: 'M21 5v6c0 1.66-4 3-9 3s-9-1.34-9-3V5' },
      { t: 'path', d: 'M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6' },
    ],
  },
  {
    id: 'cloud',
    label: 'Cloud',
    keywords: 'weather storage saas hosting',
    prims: [{ t: 'path', d: 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z' }],
  },
  {
    id: 'cpu',
    label: 'CPU',
    keywords: 'processor chip compute hardware',
    prims: [
      { t: 'rect', x: 4, y: 4, w: 16, h: 16, rx: 2 },
      { t: 'rect', x: 9, y: 9, w: 6, h: 6 },
      { t: 'line', x1: 9, y1: 1, x2: 9, y2: 4 },
      { t: 'line', x1: 15, y1: 1, x2: 15, y2: 4 },
      { t: 'line', x1: 9, y1: 20, x2: 9, y2: 23 },
      { t: 'line', x1: 15, y1: 20, x2: 15, y2: 23 },
      { t: 'line', x1: 20, y1: 9, x2: 23, y2: 9 },
      { t: 'line', x1: 20, y1: 15, x2: 23, y2: 15 },
      { t: 'line', x1: 1, y1: 9, x2: 4, y2: 9 },
      { t: 'line', x1: 1, y1: 15, x2: 4, y2: 15 },
    ],
  },
  {
    id: 'terminal',
    label: 'Terminal',
    keywords: 'console shell cli command code',
    prims: [
      { t: 'polyline', points: '4 17 10 11 4 5' },
      { t: 'line', x1: 12, y1: 19, x2: 20, y2: 19 },
    ],
  },
  {
    id: 'code',
    label: 'Code',
    keywords: 'develop programming brackets dev',
    prims: [
      { t: 'polyline', points: '16 18 22 12 16 6' },
      { t: 'polyline', points: '8 6 2 12 8 18' },
    ],
  },
  {
    id: 'git-branch',
    label: 'Git branch',
    keywords: 'version control vcs fork merge',
    prims: [
      { t: 'line', x1: 6, y1: 3, x2: 6, y2: 15 },
      { t: 'circle', cx: 18, cy: 6, r: 3 },
      { t: 'circle', cx: 6, cy: 18, r: 3 },
      { t: 'path', d: 'M18 9a9 9 0 0 1-9 9' },
    ],
  },
  {
    id: 'package',
    label: 'Package',
    keywords: 'box build artifact module bundle',
    prims: [
      {
        t: 'path',
        d: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
      },
      { t: 'polyline', points: '3.27 6.96 12 12.01 20.73 6.96' },
      { t: 'line', x1: 12, y1: 22.08, x2: 12, y2: 12 },
    ],
  },
  {
    id: 'globe',
    label: 'Globe',
    keywords: 'world internet web network earth',
    prims: [
      { t: 'circle', cx: 12, cy: 12, r: 10 },
      { t: 'line', x1: 2, y1: 12, x2: 22, y2: 12 },
      {
        t: 'path',
        d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
      },
    ],
  },
  {
    id: 'shield',
    label: 'Shield',
    keywords: 'security protect safe privacy',
    prims: [{ t: 'path', d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }],
  },
  {
    id: 'lock',
    label: 'Lock',
    keywords: 'security private secure password auth',
    prims: [
      { t: 'rect', x: 3, y: 11, w: 18, h: 11, rx: 2 },
      { t: 'path', d: 'M7 11V7a5 5 0 0 1 10 0v4' },
    ],
  },
  {
    id: 'key',
    label: 'Key',
    keywords: 'auth credential password access secret',
    prims: [
      { t: 'circle', cx: 7.5, cy: 15.5, r: 5.5 },
      { t: 'line', x1: 11.5, y1: 11.5, x2: 21, y2: 2 },
      { t: 'line', x1: 15.5, y1: 7.5, x2: 19, y2: 11 },
      { t: 'line', x1: 18, y1: 5, x2: 21, y2: 8 },
    ],
  },
  {
    id: 'wifi',
    label: 'Wi-Fi',
    keywords: 'network wireless signal internet connection',
    prims: [
      { t: 'path', d: 'M5 12.55a11 11 0 0 1 14.08 0' },
      { t: 'path', d: 'M1.42 9a16 16 0 0 1 21.16 0' },
      { t: 'path', d: 'M8.53 16.11a6 6 0 0 1 6.95 0' },
      { t: 'line', x1: 12, y1: 20, x2: 12.01, y2: 20 },
    ],
  },
  {
    id: 'monitor',
    label: 'Monitor',
    keywords: 'screen display desktop computer',
    prims: [
      { t: 'rect', x: 2, y: 3, w: 20, h: 14, rx: 2 },
      { t: 'line', x1: 8, y1: 21, x2: 16, y2: 21 },
      { t: 'line', x1: 12, y1: 17, x2: 12, y2: 21 },
    ],
  },
  {
    id: 'smartphone',
    label: 'Smartphone',
    keywords: 'phone mobile device cell',
    prims: [
      { t: 'rect', x: 5, y: 2, w: 14, h: 20, rx: 2 },
      { t: 'line', x1: 12, y1: 18, x2: 12.01, y2: 18 },
    ],
  },
  {
    id: 'folder',
    label: 'Folder',
    keywords: 'directory files storage',
    prims: [
      {
        t: 'path',
        d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
      },
    ],
  },
  {
    id: 'file',
    label: 'File',
    keywords: 'document page paper',
    prims: [
      { t: 'path', d: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z' },
      { t: 'polyline', points: '13 2 13 9 20 9' },
    ],
  },
  {
    id: 'mail',
    label: 'Mail',
    keywords: 'email envelope message inbox',
    prims: [
      { t: 'rect', x: 2, y: 4, w: 20, h: 16, rx: 2 },
      { t: 'polyline', points: '22 6 12 13 2 6' },
    ],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    keywords: 'date schedule event time',
    prims: [
      { t: 'rect', x: 3, y: 4, w: 18, h: 18, rx: 2 },
      { t: 'line', x1: 16, y1: 2, x2: 16, y2: 6 },
      { t: 'line', x1: 8, y1: 2, x2: 8, y2: 6 },
      { t: 'line', x1: 3, y1: 10, x2: 21, y2: 10 },
    ],
  },
  {
    id: 'clock',
    label: 'Clock',
    keywords: 'time watch schedule timer',
    prims: [
      { t: 'circle', cx: 12, cy: 12, r: 10 },
      { t: 'polyline', points: '12 6 12 12 16 14' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    keywords: 'gear cog config preferences options',
    prims: [
      { t: 'circle', cx: 12, cy: 12, r: 3 },
      {
        t: 'path',
        d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
      },
    ],
  },
  {
    id: 'search',
    label: 'Search',
    keywords: 'find magnifier lookup query',
    prims: [
      { t: 'circle', cx: 11, cy: 11, r: 8 },
      { t: 'line', x1: 21, y1: 21, x2: 16.65, y2: 16.65 },
    ],
  },
  {
    id: 'bell',
    label: 'Bell',
    keywords: 'notification alert reminder',
    prims: [
      { t: 'path', d: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9' },
      { t: 'path', d: 'M13.73 21a2 2 0 0 1-3.46 0' },
    ],
  },
  {
    id: 'star',
    label: 'Star',
    keywords: 'favourite rating bookmark like',
    prims: [
      {
        t: 'polygon',
        points:
          '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2',
      },
    ],
  },
  {
    id: 'heart',
    label: 'Heart',
    keywords: 'love like favourite',
    prims: [
      {
        t: 'path',
        d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
      },
    ],
  },
  {
    id: 'home',
    label: 'Home',
    keywords: 'house dashboard main start',
    prims: [
      { t: 'path', d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
      { t: 'polyline', points: '9 22 9 12 15 12 15 22' },
    ],
  },
  {
    id: 'link',
    label: 'Link',
    keywords: 'chain url hyperlink connect',
    prims: [
      { t: 'path', d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' },
      { t: 'path', d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
    ],
  },
  {
    id: 'zap',
    label: 'Lightning',
    keywords: 'flash bolt power energy fast',
    prims: [{ t: 'polygon', points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' }],
  },
  {
    id: 'map-pin',
    label: 'Map pin',
    keywords: 'location place marker geo address',
    prims: [
      { t: 'path', d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z' },
      { t: 'circle', cx: 12, cy: 10, r: 3 },
    ],
  },
  {
    id: 'message',
    label: 'Message',
    keywords: 'chat comment bubble talk speech',
    prims: [
      {
        t: 'path',
        d: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z',
      },
    ],
  },
  {
    id: 'check-circle',
    label: 'Check',
    keywords: 'done complete success tick ok approved',
    prims: [
      { t: 'path', d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' },
      { t: 'polyline', points: '22 4 12 14.01 9 11.01' },
    ],
  },
  {
    id: 'alert-triangle',
    label: 'Warning',
    keywords: 'alert caution error danger exclamation',
    prims: [
      {
        t: 'path',
        d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
      },
      { t: 'line', x1: 12, y1: 9, x2: 12, y2: 13 },
      { t: 'line', x1: 12, y1: 17, x2: 12.01, y2: 17 },
    ],
  },
  {
    id: 'image',
    label: 'Image',
    keywords: 'picture photo media gallery',
    prims: [
      { t: 'rect', x: 3, y: 3, w: 18, h: 18, rx: 2 },
      { t: 'circle', cx: 8.5, cy: 8.5, r: 1.5 },
      { t: 'polyline', points: '21 15 16 10 5 21' },
    ],
  },
];

// Fallback when an iconId isn't in the catalogue (e.g. a diagram saved
// against a newer build): a simple framed question mark so the element
// is still visibly an icon placeholder rather than empty space.
export const PLACEHOLDER_ICON: IconDef = {
  id: '__placeholder__',
  label: 'Unknown icon',
  keywords: '',
  prims: [
    { t: 'rect', x: 3, y: 3, w: 18, h: 18, rx: 3 },
    { t: 'path', d: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.5 1-1.5 1.9v.3' },
    { t: 'line', x1: 12, y1: 17, x2: 12.01, y2: 17 },
  ],
};

export const DEFAULT_ICON_ID = ICON_CATALOG[0]!.id;

const ICON_BY_ID = new Map(ICON_CATALOG.map((i) => [i.id, i]));

export function getIcon(id: string | undefined): IconDef {
  return (id && ICON_BY_ID.get(id)) || PLACEHOLDER_ICON;
}

// Case-insensitive search over label + keywords + id. Empty query
// returns the whole catalogue (the picker shows everything by default).
export function searchIcons(query: string): IconDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return ICON_CATALOG;
  return ICON_CATALOG.filter(
    (i) => i.label.toLowerCase().includes(q) || i.keywords.includes(q) || i.id.includes(q),
  );
}

// Theme chips for the Icons accordion: a handful of categories so the
// user can narrow ~35 glyphs to the dozen related to what they're
// drawing. Kept as id-lists here (rather than a per-icon field) so the
// catalogue entries stay focused on geometry; an icon may sit in one
// category. The picker prepends an "All" chip itself.
export type IconCategory = { id: string; label: string; iconIds: string[] };

export const ICON_CATEGORIES: IconCategory[] = [
  {
    id: 'tech',
    label: 'Tech',
    iconIds: [
      'server',
      'database',
      'cloud',
      'cpu',
      'terminal',
      'code',
      'git-branch',
      'package',
      'wifi',
      'monitor',
      'smartphone',
      'globe',
    ],
  },
  { id: 'people', label: 'People', iconIds: ['user', 'users', 'heart', 'message', 'mail'] },
  { id: 'security', label: 'Security', iconIds: ['shield', 'lock', 'key'] },
  { id: 'files', label: 'Files', iconIds: ['folder', 'file', 'image'] },
  {
    id: 'ui',
    label: 'UI',
    iconIds: [
      'settings',
      'search',
      'bell',
      'star',
      'home',
      'link',
      'zap',
      'check-circle',
      'alert-triangle',
      'calendar',
      'clock',
      'map-pin',
    ],
  },
];

// Icons in a category (existing catalogue entries only), in catalogue
// order. Unknown category id → empty.
export function iconsInCategory(categoryId: string): IconDef[] {
  const cat = ICON_CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return [];
  const ids = new Set(cat.iconIds);
  return ICON_CATALOG.filter((i) => ids.has(i.id));
}
