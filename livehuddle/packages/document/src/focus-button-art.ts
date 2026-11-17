// Bring Focus's drawing (docs/specs/012-collaboration/bring-focus.md "The element"; furniture-art-style.md): a real push
// button, the kind you would find on a desk. A walnut base lit from above, a brass ring, a red dome with the target
// engraved on it, and a cream nameplate for its label. Shared by the canvas (FocusButtonFace) and the export
// (svgBehaviourFace), the same on every paper, as a real object is. Pure.

export const FOCUS_BUTTON_ART = {
  // The dome's radius, its brass ring's, and how far the dome sits above the face's middle (px).
  dome: 15,
  ring: 19,
  rise: 12,
  // The nameplate under it.
  plate: { h: 18, rx: 4, below: 14 },
  tones: {
    base: '#7c4f2c',
    baseLit: '#9a6a3f',
    baseEdge: '#4d2f18',
    brass: '#d9b56a',
    brassLit: '#f0d79a',
    brassEdge: '#8a6a2a',
    dome: '#c8503c',
    domeLit: '#ef8a72',
    domeDeep: '#8e2f22',
    engrave: '#fbe3da',
    plate: '#f4efe4',
    plateEdge: '#b9a88e',
    ink: '#2f241b',
  },
} as const;
