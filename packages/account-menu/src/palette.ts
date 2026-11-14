// The account control's colours, light and dark (liveworkspace/docs/specs/010-site/site.md "The header"), as custom
// properties set on the control's root and read only by its own classes (`bg-(--account-hover)` and so on).
//
// Why not plain `text-slate-700 dark:text-slate-200` pairs: the dark variant (packages/tailwind-config/theme.css)
// adds no specificity, so a pair is settled by which rule comes last in the one utilities layer every stylesheet on
// the page shares. A page's own stylesheet loaded after the site's (the telemetry dashboard's, which Next also keeps
// after a client-side move away) emits `hover:bg-slate-100` again without the dark rule, and the hovered row turned
// pale under white text in dark mode. No other stylesheet emits these classes unless it scans this folder, and then
// it emits both halves of every pair in their order, so the menu looks the same whatever loads after it.
//
// One class per line: Tailwind reads the classes out of this file's text.
export const ACCOUNT_PALETTE = [
  // Names: the trigger, the menu's heading, each item's label; the Sign in button's fill.
  '[--account-ink:var(--color-slate-900)]',
  'dark:[--account-ink:var(--color-white)]',
  // The Sign in button's label, on the ink.
  '[--account-on-ink:var(--color-white)]',
  'dark:[--account-on-ink:var(--color-slate-900)]',
  // An item's own text (Sign Out), and the Sign in button's hover.
  '[--account-text:var(--color-slate-700)]',
  'dark:[--account-text:var(--color-slate-200)]',
  // Hints under the names, the Sign Out glyph.
  '[--account-hint:var(--color-slate-500)]',
  'dark:[--account-hint:var(--color-slate-400)]',
  // The hints on a hovered or keyboard-focused item (12 px text on --account-hover): slate-500 there measured 4.35:1,
  // under AA, so a hovered row darkens them to slate-600 (6.9:1). Dark mode keeps its hint (slate-400).
  '[--account-hint-hover:var(--color-slate-600)]',
  'dark:[--account-hint-hover:var(--color-slate-400)]',
  // A refused sign-out, said in the hint's place.
  '[--account-error:var(--color-red-700)]',
  'dark:[--account-error:var(--color-red-300)]',
  // The menu's surface, and the hairlines on it.
  '[--account-surface:var(--color-white)]',
  'dark:[--account-surface:var(--color-slate-800)]',
  '[--account-line:var(--color-slate-200)]',
  'dark:[--account-line:var(--color-slate-700)]',
  // A hovered or keyboard-focused item, on the surface.
  '[--account-hover:var(--color-slate-100)]',
  'dark:[--account-hover:color-mix(in_oklab,var(--color-slate-700)_60%,transparent)]',
  // The trigger, hovered or open, on the header.
  '[--account-raised:var(--color-slate-100)]',
  'dark:[--account-raised:var(--color-slate-800)]',
  // An item's icon square and its glyph.
  '[--account-tile:var(--color-slate-100)]',
  'dark:[--account-tile:var(--color-slate-700)]',
  '[--account-tile-ink:var(--color-slate-600)]',
  'dark:[--account-tile-ink:var(--color-slate-300)]',
  // A guest's neutral disc, its glyph, and the hairline round every avatar.
  '[--account-disc:var(--color-slate-200)]',
  'dark:[--account-disc:var(--color-slate-700)]',
  '[--account-disc-ink:var(--color-slate-500)]',
  'dark:[--account-disc-ink:var(--color-slate-300)]',
  '[--account-disc-ring:color-mix(in_oklab,var(--color-black)_5%,transparent)]',
  'dark:[--account-disc-ring:color-mix(in_oklab,var(--color-white)_10%,transparent)]',
  // The placeholder's disc, while the menu's code is on the way.
  '[--account-pending:var(--color-slate-200)]',
  'dark:[--account-pending:var(--color-slate-800)]',
].join(' ');
