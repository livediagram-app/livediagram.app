// The lamps (docs/specs/009-elements/office-amenities.md "Lamps"): a Floor Lamp, a Table Lamp and a Desk Lamp, drawn
// in the furniture's vocabulary (seating.ts), upright from the room's camera like the rest of the office, which both
// renderers paint (the editor's views and svg-render-faces). Each shade is lit from within, its open rim brighter, and
// a soft warm pool of light falls round its foot (a `dye` part, half seen through, so it warms whatever floor or desk
// it lies on). The light is drawn, never a light in a scene. They join OFFICE_ART (office.ts); the footprints are
// @livehuddle/avatar's. Pure: no React, no DOM.

import type { FurnitureDrawing } from './seating';
import { allSides, ellipse, path, rect } from './furniture-parts';

// Fixed colours: the warm shade and its light, the pool it throws, and the floor lamp's brass. The table lamp's base
// and the desk lamp's base, arms and head have none: they take the piece's own colour, else a wash of its stroke.
export const LAMP_TONES = {
  shade: '#fbe1a4',
  lit: '#fff6d6',
  pool: '#ffe39a',
  poolCore: '#fff1c8',
  brass: '#c9a35c',
  brassDeep: '#8c6a2e',
} as const;

const T = LAMP_TONES;

// A tall standing lamp: a domed brass base, a slim pole with its switch collar, a drum shade tapering to its top,
// lit from within (the glow at its open rim and out of its top), a finial, and a warm pool on the floor round its foot.
const FLOOR_LAMP_VIEW: FurnitureDrawing = {
  width: 48,
  height: 136,
  parts: [
    ellipse('dye', 24, 131, 23, 4.5, T.pool),
    ellipse('dye', 24, 131, 14, 2.8, T.poolCore),
    ellipse('shadow', 24, 131.5, 11, 2),
    rect('panel', 22.5, 40, 3, 84, 1.5, T.brass),
    rect('panel', 21.5, 84, 5, 5, 1.5, T.brassDeep),
    path('panel', 'M13 131.5C13 126 17.5 123 24 123C30.5 123 35 126 35 131.5Z', T.brass),
    path('glint', 'M17.5 127.5C18.5 125.8 20.5 125 22 124.8'),
    rect('panel', 20.5, 36, 7, 6, 1.5, T.brassDeep),
    ellipse('mark', 24, 40, 17, 3, T.lit),
    path('panel', 'M12 8H36L41 40H7Z', T.shade),
    path('rail', 'M12.6 12H35.4M7.6 36H40.4'),
    path('glint', 'M15 13L12.5 33'),
    ellipse('mark', 24, 8, 12, 1.6, T.lit),
    ellipse('mark', 24, 5.5, 1.8, 1.8, T.brassDeep),
  ],
  seats: [],
};

// A small lamp for a desk or a side table: a round ceramic base on a brass neck, an empire shade lit from within, and
// a little pool of light on the top it stands on.
const TABLE_LAMP_VIEW: FurnitureDrawing = {
  width: 36,
  height: 48,
  parts: [
    ellipse('dye', 18, 45.5, 17, 2.4, T.pool),
    ellipse('shadow', 18, 46, 9, 1.6),
    path(
      'panel',
      'M13 46.5C11 46.5 10.5 45 11.2 43.5C9.2 41.5 8 38.5 8 35.5C8 30 12.5 26.5 18 26.5C23.5 26.5 28 30 28 35.5C28 38.5 26.8 41.5 24.8 43.5C25.5 45 25 46.5 23 46.5Z',
    ),
    path('rail', 'M8.6 33.5C13 35 23 35 27.4 33.5'),
    path('glint', 'M12 33C11.5 35.5 12 38 13.5 40'),
    rect('panel', 16, 22, 4, 5, 1, T.brass),
    ellipse('mark', 18, 23, 13.5, 2.4, T.lit),
    path('panel', 'M11 4H25L31 23H5Z', T.shade),
    path('rail', 'M11.6 7H24.4M5.9 20H30.1'),
    path('glint', 'M13 7.5L10 19'),
    ellipse('mark', 18, 4, 7, 1.2, T.lit),
    ellipse('mark', 18, 2.3, 1.4, 1.4, T.brassDeep),
  ],
  seats: [],
};

// An angled task lamp: a round weighted base, a lower arm with its spring up to the elbow, an upper arm out over the
// desk, and a cone head tipped down at it with its lit rim, throwing a pool of light on the desk in front.
const DESK_LAMP_VIEW: FurnitureDrawing = {
  width: 36,
  height: 44,
  parts: [
    ellipse('dye', 25, 41.5, 10, 2.2, T.pool),
    ellipse('dye', 25, 41.5, 6, 1.3, T.poolCore),
    ellipse('shadow', 10, 42, 8, 1.5),
    path('panel', 'M2.5 42.5C2.5 39.5 5.5 37.5 10 37.5C14.5 37.5 17.5 39.5 17.5 42.5Z'),
    rect('panel', 8.8, 34.5, 2.4, 4, 1),
    path('panel', 'M8.8 35.5L4.3 18.4L6.7 17.8L11.2 34.9Z'),
    path('rail', 'M6.4 30.5l2.6-.7M5.8 28.2l2.6-.7M5.2 25.9l2.6-.7'),
    ellipse('face', 5.5, 18, 2.3, 2.3),
    path('panel', 'M5 16.8L22.5 9L23.5 11.2L6 19.2Z'),
    path('panel', 'M21.95 9.85C22.5 7.5 25.5 6.8 26.65 8.15L34.5 18.1L22.3 22.5Z'),
    ellipse('face', 23.5, 9.6, 2, 2),
    path('glint', 'M24.5 12L23.5 18'),
    path('mark', 'M22.3 22.5L34.5 18.1C35.3 20.3 32 23 28.5 24C25 25 22.6 24 22.3 22.5Z', T.lit),
    path('rail', 'M22.3 22.5L34.5 18.1'),
  ],
  seats: [],
};

/** The lamps this module draws, for OFFICE_ART. A lamp reads the same from every side and does not turn. */
export const OFFICE_LAMP_ART = {
  'floor-lamp': allSides(FLOOR_LAMP_VIEW),
  'table-lamp': allSides(TABLE_LAMP_VIEW),
  'desk-lamp': allSides(DESK_LAMP_VIEW),
} as const;
