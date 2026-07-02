// Icon catalogue data, part 1 of 2 (general / arrows / etc). Split in two
// purely to keep each file under the ~1000-line budget; the parts are
// concatenated back together by consumers: the editor's lib/icon-registry.ts
// dynamic-imports them (async chunk, off its first-load JS — import it ONLY
// through the registry there), and the Workers static-import via ./resolve.
// Order matters (the first entry is the default icon), so part 1 stays first.
import type { IconDef } from './types';

export const ICON_CATALOG_1: IconDef[] = [
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
];
