// The part builders every office drawing module writes its tables with (office.ts, office-garden.ts, office-social.ts,
// office-recreation.ts, office-wayfinding.ts): one rect, ellipse or path in the furniture's vocabulary, with its own
// fill or none (the seat's colour), and a drawing that reads the same from every side. Shared with livediagram, so
// they are @liveworkspace/avatar/furniture-art's, re-exported here. Pure.

export { allSides, ellipse, path, rect } from '@liveworkspace/avatar/furniture-art';
