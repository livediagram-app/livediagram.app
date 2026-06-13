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

// Drag-from-palette MIME: a palette tile dragged onto the canvas drops a new
// element at that point. Value carried = the ShapeKind (shapes + devices).
export const PALETTE_DND_MIME = 'application/x-livediagram-palette';

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
  {
    id: 'layers',
    label: 'Layers',
    keywords: 'stack tiers levels group',
    prims: [
      { t: 'polygon', points: '12 2 2 7 12 12 22 7 12 2' },
      { t: 'polyline', points: '2 17 12 22 22 17' },
      { t: 'polyline', points: '2 12 12 17 22 12' },
    ],
  },
  {
    id: 'box',
    label: 'Box',
    keywords: 'package cube container 3d',
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
    id: 'external-link',
    label: 'External link',
    keywords: 'open out web url visit',
    prims: [
      { t: 'path', d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' },
      { t: 'polyline', points: '15 3 21 3 21 9' },
      { t: 'line', x1: 10, y1: 14, x2: 21, y2: 3 },
    ],
  },
  {
    id: 'download',
    label: 'Download',
    keywords: 'save export down arrow',
    prims: [
      { t: 'path', d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' },
      { t: 'polyline', points: '7 10 12 15 17 10' },
      { t: 'line', x1: 12, y1: 15, x2: 12, y2: 3 },
    ],
  },
  {
    id: 'upload',
    label: 'Upload',
    keywords: 'import send up arrow',
    prims: [
      { t: 'path', d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' },
      { t: 'polyline', points: '17 8 12 3 7 8' },
      { t: 'line', x1: 12, y1: 3, x2: 12, y2: 15 },
    ],
  },
  {
    id: 'send',
    label: 'Send',
    keywords: 'message paper plane submit',
    prims: [
      { t: 'line', x1: 22, y1: 2, x2: 11, y2: 13 },
      { t: 'polygon', points: '22 2 15 22 11 13 2 9 22 2' },
    ],
  },
  {
    id: 'phone',
    label: 'Phone',
    keywords: 'call contact telephone',
    prims: [
      {
        t: 'path',
        d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z',
      },
    ],
  },
  {
    id: 'camera',
    label: 'Camera',
    keywords: 'photo capture snapshot',
    prims: [
      {
        t: 'path',
        d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z',
      },
      { t: 'circle', cx: 12, cy: 13, r: 4 },
    ],
  },
  {
    id: 'eye',
    label: 'View',
    keywords: 'eye see visible watch preview',
    prims: [
      { t: 'path', d: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z' },
      { t: 'circle', cx: 12, cy: 12, r: 3 },
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    keywords: 'pencil write modify change',
    prims: [
      { t: 'path', d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' },
      { t: 'path', d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' },
    ],
  },
  {
    id: 'trash',
    label: 'Delete',
    keywords: 'trash bin remove rubbish',
    prims: [
      { t: 'polyline', points: '3 6 5 6 21 6' },
      {
        t: 'path',
        d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
      },
    ],
  },
  {
    id: 'filter',
    label: 'Filter',
    keywords: 'funnel sort narrow refine',
    prims: [{ t: 'polygon', points: '22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3' }],
  },
  {
    id: 'tag',
    label: 'Tag',
    keywords: 'label badge price category',
    prims: [
      {
        t: 'path',
        d: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z',
      },
      { t: 'line', x1: 7, y1: 7, x2: 7.01, y2: 7 },
    ],
  },
  {
    id: 'flag',
    label: 'Flag',
    keywords: 'milestone marker goal banner',
    prims: [
      { t: 'path', d: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' },
      { t: 'line', x1: 4, y1: 22, x2: 4, y2: 15 },
    ],
  },
  {
    id: 'bar-chart',
    label: 'Bar chart',
    keywords: 'graph stats metrics analytics',
    prims: [
      { t: 'line', x1: 12, y1: 20, x2: 12, y2: 10 },
      { t: 'line', x1: 18, y1: 20, x2: 18, y2: 4 },
      { t: 'line', x1: 6, y1: 20, x2: 6, y2: 16 },
    ],
  },
  {
    id: 'pie-chart',
    label: 'Pie chart',
    keywords: 'graph stats share segment analytics',
    prims: [
      { t: 'path', d: 'M21.21 15.89A10 10 0 1 1 8 2.83' },
      { t: 'path', d: 'M22 12A10 10 0 0 0 12 2v10z' },
    ],
  },
  {
    id: 'trending-up',
    label: 'Trending up',
    keywords: 'growth increase arrow graph analytics',
    prims: [
      { t: 'polyline', points: '23 6 13.5 15.5 8.5 10.5 1 18' },
      { t: 'polyline', points: '17 6 23 6 23 12' },
    ],
  },
  {
    id: 'briefcase',
    label: 'Briefcase',
    keywords: 'work business job office case',
    prims: [
      { t: 'rect', x: 2, y: 7, w: 20, h: 14, rx: 2 },
      { t: 'path', d: 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' },
    ],
  },
  {
    id: 'book',
    label: 'Book',
    keywords: 'docs documentation read manual notes',
    prims: [
      { t: 'path', d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' },
      { t: 'path', d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
    ],
  },
  {
    id: 'clipboard',
    label: 'Clipboard',
    keywords: 'copy paste tasks list notes',
    prims: [
      {
        t: 'path',
        d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
      },
      { t: 'rect', x: 8, y: 2, w: 8, h: 4, rx: 1 },
    ],
  },
  {
    id: 'dollar-sign',
    label: 'Money',
    keywords: 'dollar currency cost price payment',
    prims: [
      { t: 'line', x1: 12, y1: 1, x2: 12, y2: 23 },
      { t: 'path', d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
    ],
  },
  {
    id: 'credit-card',
    label: 'Card',
    keywords: 'payment billing money credit debit',
    prims: [
      { t: 'rect', x: 1, y: 4, w: 22, h: 16, rx: 2 },
      { t: 'line', x1: 1, y1: 10, x2: 23, y2: 10 },
    ],
  },
  {
    id: 'cart',
    label: 'Cart',
    keywords: 'shopping basket buy ecommerce store',
    prims: [
      { t: 'circle', cx: 9, cy: 21, r: 1 },
      { t: 'circle', cx: 20, cy: 21, r: 1 },
      { t: 'path', d: 'M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6' },
    ],
  },
  {
    id: 'tool',
    label: 'Tool',
    keywords: 'wrench spanner fix settings build',
    prims: [
      {
        t: 'path',
        d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
      },
    ],
  },
  {
    id: 'power',
    label: 'Power',
    keywords: 'on off toggle start stop switch',
    prims: [
      { t: 'path', d: 'M18.36 6.64a9 9 0 1 1-12.73 0' },
      { t: 'line', x1: 12, y1: 2, x2: 12, y2: 12 },
    ],
  },
  {
    id: 'arrow-right',
    label: 'Arrow right',
    keywords: 'next forward direction flow',
    prims: [
      { t: 'line', x1: 5, y1: 12, x2: 19, y2: 12 },
      { t: 'polyline', points: '12 5 19 12 12 19' },
    ],
  },
  {
    id: 'arrow-left',
    label: 'Arrow left',
    keywords: 'back previous direction flow',
    prims: [
      { t: 'line', x1: 19, y1: 12, x2: 5, y2: 12 },
      { t: 'polyline', points: '12 19 5 12 12 5' },
    ],
  },
  {
    id: 'arrow-up',
    label: 'Arrow up',
    keywords: 'top direction flow increase',
    prims: [
      { t: 'line', x1: 12, y1: 19, x2: 12, y2: 5 },
      { t: 'polyline', points: '5 12 12 5 19 12' },
    ],
  },
  {
    id: 'arrow-down',
    label: 'Arrow down',
    keywords: 'bottom direction flow decrease',
    prims: [
      { t: 'line', x1: 12, y1: 5, x2: 12, y2: 19 },
      { t: 'polyline', points: '19 12 12 19 5 12' },
    ],
  },
  {
    id: 'plus',
    label: 'Plus',
    keywords: 'add new create increment',
    prims: [
      { t: 'line', x1: 12, y1: 5, x2: 12, y2: 19 },
      { t: 'line', x1: 5, y1: 12, x2: 19, y2: 12 },
    ],
  },
  {
    id: 'check',
    label: 'Check',
    keywords: 'tick done complete yes ok',
    prims: [{ t: 'polyline', points: '20 6 9 17 4 12' }],
  },
  {
    id: 'x',
    label: 'Close',
    keywords: 'x cross cancel no remove',
    prims: [
      { t: 'line', x1: 18, y1: 6, x2: 6, y2: 18 },
      { t: 'line', x1: 6, y1: 6, x2: 18, y2: 18 },
    ],
  },
  {
    id: 'activity',
    label: 'Activity',
    keywords: 'pulse heartbeat monitor health graph',
    prims: [{ t: 'polyline', points: '22 12 18 12 15 21 9 3 6 12 2 12' }],
  },
  // --- Tech ---
  {
    id: 'hard-drive',
    label: 'Hard drive',
    keywords: 'disk storage hdd ssd volume',
    prims: [
      { t: 'line', x1: 22, y1: 12, x2: 2, y2: 12 },
      {
        t: 'path',
        d: 'M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
      },
      { t: 'line', x1: 6, y1: 16, x2: 6.01, y2: 16 },
      { t: 'line', x1: 10, y1: 16, x2: 10.01, y2: 16 },
    ],
  },
  {
    id: 'bluetooth',
    label: 'Bluetooth',
    keywords: 'wireless pairing connection signal',
    prims: [{ t: 'polyline', points: '6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5' }],
  },
  {
    id: 'battery',
    label: 'Battery',
    keywords: 'power charge energy level',
    prims: [
      { t: 'rect', x: 1, y: 6, w: 18, h: 12, rx: 2 },
      { t: 'line', x1: 23, y1: 13, x2: 23, y2: 11 },
    ],
  },
  {
    id: 'cast',
    label: 'Cast',
    keywords: 'stream airplay screen mirror broadcast',
    prims: [
      {
        t: 'path',
        d: 'M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6',
      },
      { t: 'line', x1: 2, y1: 20, x2: 2.01, y2: 20 },
    ],
  },
  {
    id: 'command',
    label: 'Command',
    keywords: 'cmd key shortcut mac control',
    prims: [
      {
        t: 'path',
        d: 'M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z',
      },
    ],
  },
  {
    id: 'share-2',
    label: 'Share',
    keywords: 'network nodes connect distribute social',
    prims: [
      { t: 'circle', cx: 18, cy: 5, r: 3 },
      { t: 'circle', cx: 6, cy: 12, r: 3 },
      { t: 'circle', cx: 18, cy: 19, r: 3 },
      { t: 'line', x1: 8.59, y1: 13.51, x2: 15.42, y2: 17.49 },
      { t: 'line', x1: 15.41, y1: 6.51, x2: 8.59, y2: 10.49 },
    ],
  },
  // --- People ---
  {
    id: 'user-plus',
    label: 'Add user',
    keywords: 'person invite new member signup',
    prims: [
      { t: 'path', d: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' },
      { t: 'circle', cx: 8.5, cy: 7, r: 4 },
      { t: 'line', x1: 20, y1: 8, x2: 20, y2: 14 },
      { t: 'line', x1: 23, y1: 11, x2: 17, y2: 11 },
    ],
  },
  {
    id: 'user-check',
    label: 'User verified',
    keywords: 'person approved confirmed member check',
    prims: [
      { t: 'path', d: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' },
      { t: 'circle', cx: 8.5, cy: 7, r: 4 },
      { t: 'polyline', points: '17 11 19 13 23 9' },
    ],
  },
  {
    id: 'smile',
    label: 'Smile',
    keywords: 'happy face emoji satisfied feedback',
    prims: [
      { t: 'circle', cx: 12, cy: 12, r: 10 },
      { t: 'path', d: 'M8 14s1.5 2 4 2 4-2 4-2' },
      { t: 'line', x1: 9, y1: 9, x2: 9.01, y2: 9 },
      { t: 'line', x1: 15, y1: 9, x2: 15.01, y2: 9 },
    ],
  },
  {
    id: 'award',
    label: 'Award',
    keywords: 'medal prize badge winner achievement',
    prims: [
      { t: 'circle', cx: 12, cy: 8, r: 7 },
      { t: 'polyline', points: '8.21 13.89 7 23 12 20 17 23 15.79 13.88' },
    ],
  },
  {
    id: 'thumbs-up',
    label: 'Thumbs up',
    keywords: 'like approve vote positive good',
    prims: [
      {
        t: 'path',
        d: 'M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3',
      },
    ],
  },
  // --- Security ---
  {
    id: 'unlock',
    label: 'Unlock',
    keywords: 'open security unsecure access padlock',
    prims: [
      { t: 'rect', x: 3, y: 11, w: 18, h: 11, rx: 2 },
      { t: 'path', d: 'M7 11V7a5 5 0 0 1 9.9-1' },
    ],
  },
  {
    id: 'eye-off',
    label: 'Hidden',
    keywords: 'hide invisible private conceal eye',
    prims: [
      {
        t: 'path',
        d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24',
      },
      { t: 'line', x1: 1, y1: 1, x2: 23, y2: 23 },
    ],
  },
  // --- Files ---
  {
    id: 'file-text',
    label: 'Document',
    keywords: 'file page text lines paper doc',
    prims: [
      { t: 'path', d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
      { t: 'polyline', points: '14 2 14 8 20 8' },
      { t: 'line', x1: 16, y1: 13, x2: 8, y2: 13 },
      { t: 'line', x1: 16, y1: 17, x2: 8, y2: 17 },
      { t: 'polyline', points: '10 9 9 9 8 9' },
    ],
  },
  {
    id: 'file-plus',
    label: 'New file',
    keywords: 'file add create document new',
    prims: [
      { t: 'path', d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
      { t: 'polyline', points: '14 2 14 8 20 8' },
      { t: 'line', x1: 12, y1: 18, x2: 12, y2: 12 },
      { t: 'line', x1: 9, y1: 15, x2: 15, y2: 15 },
    ],
  },
  {
    id: 'folder-plus',
    label: 'New folder',
    keywords: 'folder add create directory new',
    prims: [
      {
        t: 'path',
        d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
      },
      { t: 'line', x1: 12, y1: 11, x2: 12, y2: 17 },
      { t: 'line', x1: 9, y1: 14, x2: 15, y2: 14 },
    ],
  },
  {
    id: 'save',
    label: 'Save',
    keywords: 'disk store floppy persist write',
    prims: [
      { t: 'path', d: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z' },
      { t: 'polyline', points: '17 21 17 13 7 13 7 21' },
      { t: 'polyline', points: '7 3 7 8 15 8' },
    ],
  },
  {
    id: 'archive',
    label: 'Archive',
    keywords: 'box store backup inbox old',
    prims: [
      { t: 'polyline', points: '21 8 21 21 3 21 3 8' },
      { t: 'rect', x: 1, y: 3, w: 22, h: 5 },
      { t: 'line', x1: 10, y1: 12, x2: 14, y2: 12 },
    ],
  },
  {
    id: 'paperclip',
    label: 'Attachment',
    keywords: 'paperclip attach file clip link',
    prims: [
      {
        t: 'path',
        d: 'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48',
      },
    ],
  },
  // --- Charts ---
  {
    id: 'trending-down',
    label: 'Trending down',
    keywords: 'decline decrease arrow graph analytics loss',
    prims: [
      { t: 'polyline', points: '23 18 13.5 8.5 8.5 13.5 1 6' },
      { t: 'polyline', points: '17 18 23 18 23 12' },
    ],
  },
  {
    id: 'percent',
    label: 'Percent',
    keywords: 'percentage discount rate ratio share',
    prims: [
      { t: 'line', x1: 19, y1: 5, x2: 5, y2: 19 },
      { t: 'circle', cx: 6.5, cy: 6.5, r: 2.5 },
      { t: 'circle', cx: 17.5, cy: 17.5, r: 2.5 },
    ],
  },
  {
    id: 'target',
    label: 'Target',
    keywords: 'goal aim bullseye objective focus',
    prims: [
      { t: 'circle', cx: 12, cy: 12, r: 10 },
      { t: 'circle', cx: 12, cy: 12, r: 6 },
      { t: 'circle', cx: 12, cy: 12, r: 2 },
    ],
  },
  // --- UI ---
  {
    id: 'menu',
    label: 'Menu',
    keywords: 'hamburger lines navigation list bars',
    prims: [
      { t: 'line', x1: 3, y1: 12, x2: 21, y2: 12 },
      { t: 'line', x1: 3, y1: 6, x2: 21, y2: 6 },
      { t: 'line', x1: 3, y1: 18, x2: 21, y2: 18 },
    ],
  },
  {
    id: 'more-horizontal',
    label: 'More',
    keywords: 'ellipsis dots overflow options menu',
    prims: [
      { t: 'circle', cx: 12, cy: 12, r: 1 },
      { t: 'circle', cx: 19, cy: 12, r: 1 },
      { t: 'circle', cx: 5, cy: 12, r: 1 },
    ],
  },
  {
    id: 'refresh-cw',
    label: 'Refresh',
    keywords: 'reload sync update retry cycle',
    prims: [
      { t: 'polyline', points: '23 4 23 10 17 10' },
      { t: 'polyline', points: '1 20 1 14 7 14' },
      { t: 'path', d: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' },
    ],
  },
  {
    id: 'info',
    label: 'Info',
    keywords: 'information detail about help note',
    prims: [
      { t: 'circle', cx: 12, cy: 12, r: 10 },
      { t: 'line', x1: 12, y1: 16, x2: 12, y2: 12 },
      { t: 'line', x1: 12, y1: 8, x2: 12.01, y2: 8 },
    ],
  },
  {
    id: 'help-circle',
    label: 'Help',
    keywords: 'question support faq query unknown',
    prims: [
      { t: 'circle', cx: 12, cy: 12, r: 10 },
      { t: 'path', d: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' },
      { t: 'line', x1: 12, y1: 17, x2: 12.01, y2: 17 },
    ],
  },
  {
    id: 'sliders',
    label: 'Sliders',
    keywords: 'controls adjust settings filters mixer',
    prims: [
      { t: 'line', x1: 4, y1: 21, x2: 4, y2: 14 },
      { t: 'line', x1: 4, y1: 10, x2: 4, y2: 3 },
      { t: 'line', x1: 12, y1: 21, x2: 12, y2: 12 },
      { t: 'line', x1: 12, y1: 8, x2: 12, y2: 3 },
      { t: 'line', x1: 20, y1: 21, x2: 20, y2: 16 },
      { t: 'line', x1: 20, y1: 12, x2: 20, y2: 3 },
      { t: 'line', x1: 1, y1: 14, x2: 7, y2: 14 },
      { t: 'line', x1: 9, y1: 8, x2: 15, y2: 8 },
      { t: 'line', x1: 17, y1: 16, x2: 23, y2: 16 },
    ],
  },
  {
    id: 'bookmark',
    label: 'Bookmark',
    keywords: 'save favourite ribbon flag mark',
    prims: [{ t: 'path', d: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' }],
  },
  {
    id: 'share',
    label: 'Export',
    keywords: 'share send out upload arrow',
    prims: [
      { t: 'path', d: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8' },
      { t: 'polyline', points: '16 6 12 2 8 6' },
      { t: 'line', x1: 12, y1: 2, x2: 12, y2: 15 },
    ],
  },
  {
    id: 'copy',
    label: 'Copy',
    keywords: 'duplicate clone clipboard paste files',
    prims: [
      { t: 'rect', x: 9, y: 9, w: 13, h: 13, rx: 2 },
      { t: 'path', d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' },
    ],
  },
  {
    id: 'sun',
    label: 'Sun',
    keywords: 'light day bright weather theme',
    prims: [
      { t: 'circle', cx: 12, cy: 12, r: 5 },
      { t: 'line', x1: 12, y1: 1, x2: 12, y2: 3 },
      { t: 'line', x1: 12, y1: 21, x2: 12, y2: 23 },
      { t: 'line', x1: 4.22, y1: 4.22, x2: 5.64, y2: 5.64 },
      { t: 'line', x1: 18.36, y1: 18.36, x2: 19.78, y2: 19.78 },
      { t: 'line', x1: 1, y1: 12, x2: 3, y2: 12 },
      { t: 'line', x1: 21, y1: 12, x2: 23, y2: 12 },
      { t: 'line', x1: 4.22, y1: 19.78, x2: 5.64, y2: 18.36 },
      { t: 'line', x1: 18.36, y1: 5.64, x2: 19.78, y2: 4.22 },
    ],
  },
  {
    id: 'moon',
    label: 'Moon',
    keywords: 'night dark theme sleep weather',
    prims: [{ t: 'path', d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' }],
  },
  {
    id: 'alert-octagon',
    label: 'Alert',
    keywords: 'error stop critical danger warning blocked',
    prims: [
      {
        t: 'polygon',
        points: '7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2',
      },
      { t: 'line', x1: 12, y1: 8, x2: 12, y2: 12 },
      { t: 'line', x1: 12, y1: 16, x2: 12.01, y2: 16 },
    ],
  },

  // --- Furniture / room (spec/09) -----------------------------------------
  // Top-down floor-plan symbols for sketching room layouts: same single-
  // weight 0..24 outline style as the rest, drawn as if looking straight
  // down on the piece. Grouped under the "Furniture" category chip.
  {
    id: 'bed',
    label: 'Bed',
    keywords: 'bedroom sleep mattress double furniture room',
    prims: [
      { t: 'rect', x: 3, y: 3, w: 18, h: 18, rx: 2 },
      { t: 'line', x1: 3, y1: 9, x2: 21, y2: 9 },
      { t: 'rect', x: 5, y: 5, w: 5, h: 3, rx: 1 },
      { t: 'rect', x: 14, y: 5, w: 5, h: 3, rx: 1 },
    ],
  },
  {
    id: 'sofa',
    label: 'Sofa',
    keywords: 'couch settee lounge living room furniture seating',
    prims: [
      { t: 'rect', x: 2, y: 6, w: 20, h: 12, rx: 2 },
      { t: 'rect', x: 5, y: 10, w: 14, h: 8, rx: 1 },
    ],
  },
  {
    id: 'armchair',
    label: 'Armchair',
    keywords: 'chair seat lounge living room furniture',
    prims: [
      { t: 'rect', x: 6, y: 6, w: 12, h: 12, rx: 2 },
      { t: 'rect', x: 9, y: 10, w: 6, h: 8, rx: 1 },
    ],
  },
  {
    id: 'chair',
    label: 'Chair',
    keywords: 'seat dining furniture',
    prims: [
      { t: 'rect', x: 7, y: 5, w: 10, h: 3, rx: 1 },
      { t: 'rect', x: 7, y: 9, w: 10, h: 9, rx: 1 },
    ],
  },
  {
    id: 'dining-table',
    label: 'Dining table',
    keywords: 'table dining kitchen furniture',
    prims: [{ t: 'rect', x: 5, y: 6, w: 14, h: 12, rx: 2 }],
  },
  {
    id: 'coffee-table',
    label: 'Coffee table',
    keywords: 'table living room low furniture',
    prims: [{ t: 'rect', x: 4, y: 9, w: 16, h: 6, rx: 2 }],
  },
  {
    id: 'tv',
    label: 'TV',
    keywords: 'television screen entertainment monitor',
    prims: [
      { t: 'rect', x: 2, y: 4, w: 20, h: 12, rx: 2 },
      { t: 'line', x1: 12, y1: 16, x2: 12, y2: 19 },
      { t: 'line', x1: 8, y1: 19, x2: 16, y2: 19 },
    ],
  },
  {
    id: 'desk',
    label: 'Desk',
    keywords: 'office workspace table drawers furniture',
    prims: [
      { t: 'rect', x: 3, y: 8, w: 18, h: 4, rx: 1 },
      { t: 'rect', x: 14, y: 12, w: 7, h: 7, rx: 1 },
      { t: 'line', x1: 5, y1: 12, x2: 5, y2: 18 },
    ],
  },
  {
    id: 'wardrobe',
    label: 'Wardrobe',
    keywords: 'closet cupboard storage clothes furniture',
    prims: [
      { t: 'rect', x: 4, y: 3, w: 16, h: 18, rx: 1 },
      { t: 'line', x1: 12, y1: 3, x2: 12, y2: 21 },
      { t: 'line', x1: 10, y1: 11, x2: 10, y2: 13 },
      { t: 'line', x1: 14, y1: 11, x2: 14, y2: 13 },
    ],
  },
  {
    id: 'bathtub',
    label: 'Bathtub',
    keywords: 'bath tub bathroom washroom',
    prims: [
      { t: 'rect', x: 3, y: 6, w: 18, h: 12, rx: 4 },
      { t: 'rect', x: 6, y: 8, w: 11, h: 8, rx: 3 },
      { t: 'circle', cx: 8, cy: 12, r: 1 },
    ],
  },
  {
    id: 'toilet',
    label: 'Toilet',
    keywords: 'wc bathroom loo washroom',
    prims: [
      { t: 'rect', x: 8, y: 3, w: 8, h: 4, rx: 1 },
      { t: 'ellipse', cx: 12, cy: 14, rx: 4, ry: 5 },
    ],
  },
  {
    id: 'sink',
    label: 'Sink',
    keywords: 'basin washbasin bathroom kitchen tap',
    prims: [
      { t: 'rect', x: 5, y: 6, w: 14, h: 11, rx: 3 },
      { t: 'circle', cx: 12, cy: 11, r: 1 },
      { t: 'line', x1: 12, y1: 6, x2: 12, y2: 4 },
    ],
  },
  {
    id: 'stove',
    label: 'Stove',
    keywords: 'cooker hob oven kitchen burners',
    prims: [
      { t: 'rect', x: 4, y: 4, w: 16, h: 16, rx: 2 },
      { t: 'circle', cx: 9, cy: 9, r: 2 },
      { t: 'circle', cx: 15, cy: 9, r: 2 },
      { t: 'circle', cx: 9, cy: 15, r: 2 },
      { t: 'circle', cx: 15, cy: 15, r: 2 },
    ],
  },
  {
    id: 'fridge',
    label: 'Fridge',
    keywords: 'refrigerator freezer kitchen cold',
    prims: [
      { t: 'rect', x: 6, y: 2, w: 12, h: 20, rx: 2 },
      { t: 'line', x1: 6, y1: 9, x2: 18, y2: 9 },
      { t: 'line', x1: 9, y1: 5, x2: 9, y2: 7 },
      { t: 'line', x1: 9, y1: 12, x2: 9, y2: 15 },
    ],
  },
  {
    id: 'plant',
    label: 'Plant',
    keywords: 'pot houseplant greenery decor tree',
    prims: [
      { t: 'path', d: 'M9 14 H15 L14 21 H10 Z' },
      { t: 'line', x1: 12, y1: 14, x2: 12, y2: 8 },
      { t: 'path', d: 'M12 10 C 8 9 8 4 11 3' },
      { t: 'path', d: 'M12 10 C 16 9 16 4 13 3' },
    ],
  },
  {
    id: 'door',
    label: 'Door',
    keywords: 'doorway entrance swing opening',
    prims: [
      { t: 'line', x1: 5, y1: 20, x2: 5, y2: 6 },
      { t: 'path', d: 'M5 6 A 14 14 0 0 1 19 20' },
      { t: 'line', x1: 5, y1: 20, x2: 19, y2: 20 },
    ],
  },
  {
    id: 'stairs',
    label: 'Stairs',
    keywords: 'staircase steps stairway floor',
    prims: [
      { t: 'rect', x: 5, y: 3, w: 14, h: 18, rx: 1 },
      { t: 'line', x1: 5, y1: 7, x2: 19, y2: 7 },
      { t: 'line', x1: 5, y1: 11, x2: 19, y2: 11 },
      { t: 'line', x1: 5, y1: 15, x2: 19, y2: 15 },
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
      'layers',
      'box',
      'power',
      'external-link',
      'hard-drive',
      'bluetooth',
      'battery',
      'cast',
      'command',
      'share-2',
    ],
  },
  {
    id: 'people',
    label: 'People',
    iconIds: [
      'user',
      'users',
      'heart',
      'message',
      'mail',
      'phone',
      'user-plus',
      'user-check',
      'smile',
      'award',
      'thumbs-up',
    ],
  },
  {
    id: 'security',
    label: 'Security',
    iconIds: ['shield', 'lock', 'key', 'unlock', 'eye-off'],
  },
  {
    id: 'files',
    label: 'Files',
    iconIds: [
      'folder',
      'file',
      'image',
      'clipboard',
      'book',
      'download',
      'upload',
      'file-text',
      'file-plus',
      'folder-plus',
      'save',
      'archive',
      'paperclip',
    ],
  },
  {
    id: 'charts',
    label: 'Charts',
    iconIds: [
      'bar-chart',
      'pie-chart',
      'trending-up',
      'activity',
      'dollar-sign',
      'credit-card',
      'cart',
      'briefcase',
      'trending-down',
      'percent',
      'target',
    ],
  },
  {
    id: 'arrows',
    label: 'Arrows',
    iconIds: ['arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'send'],
  },
  {
    id: 'furniture',
    label: 'Furniture',
    iconIds: [
      'bed',
      'sofa',
      'armchair',
      'chair',
      'dining-table',
      'coffee-table',
      'tv',
      'desk',
      'wardrobe',
      'bathtub',
      'toilet',
      'sink',
      'stove',
      'fridge',
      'plant',
      'door',
      'stairs',
    ],
  },
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
      'eye',
      'edit',
      'trash',
      'filter',
      'tag',
      'flag',
      'plus',
      'check',
      'x',
      'camera',
      'tool',
      'menu',
      'more-horizontal',
      'refresh-cw',
      'info',
      'help-circle',
      'sliders',
      'bookmark',
      'share',
      'copy',
      'sun',
      'moon',
      'alert-octagon',
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
