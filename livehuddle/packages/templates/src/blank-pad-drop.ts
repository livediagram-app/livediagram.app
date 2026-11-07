// How far below the middle of the view a blank tab's Avatar Pad stands, centre to centre
// (docs/specs/009-elements/avatar-pad.md "Every Space and blank tab has one", D216): the middle stays free to build in,
// and the pad is in view at 100% on a phone. A module of its own so the editor reads it without loading every
// template builder (build-template.ts) into its first load.
export const BLANK_PAD_DROP = 160;
