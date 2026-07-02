// Icon catalogue data, part 2 of 2 (tech / people / security / files /
// charts / ui / furniture / animated). See icon-catalog-1.ts for why this
// is split and why it loads async; concatenated after part 1 by
// the editor's lib/icon-registry.ts (or the Workers' ./resolve).
import type { IconDef } from './types';

export const ICON_CATALOG_2: IconDef[] = [
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
  // Animated icons (spec/09 "Animated elements"). Ordinary `icon` glyphs whose
  // SVG animates via a CSS class (see ANIMATED_ICONS + iconAnimationClass).
  // The prims are the resting frame, so they read fine frozen (reduced-motion
  // / export).
  {
    id: 'spinner',
    label: 'Spinner',
    keywords: 'loading spinner progress wait busy animated spin',
    // A 3/4 arc — the gap makes the rotation read.
    prims: [{ t: 'path', d: 'M12 3 a9 9 0 1 0 9 9' }],
  },
  {
    id: 'gear',
    label: 'Gear',
    keywords: 'gear cog settings spin processing animated',
    // Hub + eight radial teeth; spins about its centre.
    prims: [
      { t: 'circle', cx: 12, cy: 12, r: 3.5 },
      { t: 'line', x1: 12, y1: 1.5, x2: 12, y2: 5 },
      { t: 'line', x1: 12, y1: 19, x2: 12, y2: 22.5 },
      { t: 'line', x1: 1.5, y1: 12, x2: 5, y2: 12 },
      { t: 'line', x1: 19, y1: 12, x2: 22.5, y2: 12 },
      { t: 'line', x1: 4.6, y1: 4.6, x2: 7.1, y2: 7.1 },
      { t: 'line', x1: 16.9, y1: 16.9, x2: 19.4, y2: 19.4 },
      { t: 'line', x1: 4.6, y1: 19.4, x2: 7.1, y2: 16.9 },
      { t: 'line', x1: 16.9, y1: 7.1, x2: 19.4, y2: 4.6 },
    ],
  },
  {
    id: 'heartbeat',
    label: 'Heartbeat',
    keywords: 'heart like love favourite favorite beat pulse animated',
    prims: [
      {
        t: 'path',
        d: 'M12 20.5 C12 20.5 4 14 4 8.8 A4 4 0 0 1 12 6.2 A4 4 0 0 1 20 8.8 C20 14 12 20.5 12 20.5 Z',
      },
    ],
  },
  {
    id: 'signal',
    label: 'Signal',
    keywords: 'signal wifi wireless network broadcast live pulse animated',
    prims: [
      { t: 'path', d: 'M5 12.5 a9 9 0 0 1 14 0' },
      { t: 'path', d: 'M8 15.5 a5 5 0 0 1 8 0' },
      { t: 'circle', cx: 12, cy: 18.5, r: 1 },
    ],
  },
];
