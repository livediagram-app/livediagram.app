// The building blocks of liveknowledge's figures (liveworkspace/docs/specs/017-help/help-centre.md "Figures and card
// icons"): the editor as a Knowledgebase draws it, scaled down. There is no canvas here: a page of writing on plain
// ground, the page tree in a sidebar at the left, one top row, and the footer whose three tabs are the views (Pages,
// Ask, AI Knowledge). Every figure in this edition is composed from these, so a change to the editor's chrome is
// drawn once. Colours are the light ramp only; the art scope turns them over for the dark appearance.
//
// The entry every figure imports: the pieces live in kit-base.tsx, kit-chrome.tsx and kit-parts.tsx.

export * from './kit-base';
export * from './kit-chrome';
export * from './kit-parts';
