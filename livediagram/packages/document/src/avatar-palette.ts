// The Avatar sprite's colour palette (docs/specs/008-canvas/avatar-mode.md "The character"). The editor's sprite
// (apps/editor avatar-sprite*.tsx) draws the character from it, and the Avatar Pad (docs/specs/009-elements/avatar-pad.md)
// is built from the same tones on the canvas and in an export, so the pad the characters stand on is visibly theirs.
// One table in the document package so the two cannot drift apart. Pure data.
export const AVATAR_PALETTE = {
  // Warm skin + brown hair, with one darker tone per material for the shaded edge that gives pixel art its volume.
  skin: '#f4c99b',
  skinDark: '#d9a674',
  hair: '#6b4423',
  hairDark: '#4a2e17',
  // The shirt is the participant's presence colour; this brand cyan when there isn't one.
  shirt: '#0ea5e9',
  trousers: '#3f4c63',
  trousersDark: '#2c3648',
  shoe: '#1e293b',
  eye: '#243044',
  shirtWhite: '#f8fafc',
  flagPole: '#b8845a',
  flagCloth: '#f43f5e',
  // Tones the later outfits need beyond the shirt colour: denim for overalls, a clinical white-coat body, and a
  // leather-ish apron.
  denim: '#41597f',
  denimDark: '#2f4260',
  coat: '#eef2f6',
  coatDark: '#cfd8e3',
  apron: '#8b5e34',
} as const;
