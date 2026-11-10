// Every product's work in miniature: a board, a sheet, a dashboard and a form (liveplanner), a flowchart, a mind map,
// a whiteboard and a workshop (livediagram), an article, a slide, an infographic and a poster (livedocuments), a logo,
// a phone and a website wireframe and a photo (livedesign), and livehuddle's Spaces (work-art-spaces.tsx). Each draws
// into the box it is handed, in SVG user units, and scales to it, so it reads the same on a laptop's screen in a help scene and in a tile on Explorer Home.
//
// Drawn in the house style of the help centres' illustration kit (@liveworkspace/help-site art/primitives): white
// paper with slate edges and ink, the `brand` ramp for accents. They hold no colour of their own: whoever draws them
// sets the ramp (a help centre's own; an Explorer tile its app's, explorer.css `.lw-work-art`) and turns them for dark
// (help-art.css, or `.lw-work-art`). `help-art-as-drawn` marks a part whose colour is its identity in both
// appearances. Static: no state, no effects, no motion. The help centres and the Explorer's hero share them
// (liveworkspace/docs/specs/004-index/one-explorer.md "What you can make, on Home's hero").

export { fitBox, type WorkBox } from './work-art-parts';
export * from './work-art-planner';
export * from './work-art-diagram';
export * from './work-art-documents';
export * from './work-art-design';
export * from './work-art-spaces';
