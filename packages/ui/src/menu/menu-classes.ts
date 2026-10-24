// The look of a small choice menu (docs/specs/004-interface-design/menus.md): the floating panel, and its
// check-marked radio rows. One source, so the editor's mode menus and the Community's search menus read as one
// family. Placement (absolute, top-full, width) stays with each caller.

export const MENU_PANEL =
  'flex animate-fade-in flex-col gap-px rounded-lg border border-slate-200/80 bg-white p-1 shadow-xl shadow-slate-900/10 motion-reduce:animate-none dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-slate-950/60';

// A menuitemradio row: tinted while checked. `weight` sets when the label is medium: always (the mode filter,
// whose rows carry an icon and a count) or only on the checked row (plain text lists, so the choice stands out).
export function menuRadioRowClass(
  checked: boolean,
  { weight = 'always' }: { weight?: 'always' | 'checked' } = {},
): string {
  const medium = weight === 'always' || checked ? ' font-medium' : '';
  return `flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm${medium} transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-brand-600 ${
    checked
      ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
  }`;
}
