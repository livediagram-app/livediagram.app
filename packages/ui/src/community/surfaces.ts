// The Community's two placeholder surfaces (docs/specs/025-community/community.md "Gallery"), as Tailwind classes so
// any app can use them without a stylesheet of its own: the canvas dot grid behind a post's image, and a loading bar
// that pulses (still under reduced motion). Shared by the card, its skeleton and the Community app's post page.

export const COMMUNITY_DOT_GRID =
  'bg-slate-50 bg-[radial-gradient(circle,rgb(148_163_184/0.35)_1px,transparent_1.2px)] bg-[length:14px_14px] dark:bg-slate-950 dark:bg-[radial-gradient(circle,rgb(100_116_139/0.3)_1px,transparent_1.2px)]';

export const COMMUNITY_SKELETON_BAR =
  'rounded bg-slate-100 animate-pulse motion-reduce:animate-none dark:bg-slate-800';
