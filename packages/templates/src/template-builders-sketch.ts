// The Draw templates (docs/specs/007-editor/templates-by-mode.md "Draw templates"): boards drawn
// with the marks a person makes in Draw mode (marker strokes with a hand wobble, sticky notes,
// hand lettering and stickers), each a real example to draw over. One file per board, built on
// the shared sketch kit (template-sketch-kit.ts) and doodles (template-sketch-figures.ts); this
// module is the one place build-template.ts imports them from.

export { buildSketchnote } from './template-sketchnote';
export { buildRichPicture } from './template-rich-picture';
export { buildComicStrip } from './template-comic-strip';
export { buildDoodleWarmup } from './template-doodle-warmup';
