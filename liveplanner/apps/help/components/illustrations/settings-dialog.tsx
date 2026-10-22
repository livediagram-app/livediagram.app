// The Settings dialog (docs/specs/007-editor/user-preferences.md), drawn once for every help
// article that shows it: the shared frame (title, search, the category list, the open pane), the
// on/off `Switch` every settings-style row in the help art uses, and the Editor and Panels panes,
// each section one grouped card as the dialog draws it.
// Categories, row labels, order and defaults are lifted from
// apps/editor/components/dialogs/settings/settings-catalogue.ts; sub-categories (Draw under Editor,
// Layers / Map / Collaborate / Quick Style under Panels) stay folded, as the dialog opens them.

import type {} from 'react';

/** An on/off switch, brand when on. `sm` sits in a Settings row; `md` in a roomier card. */
export function Switch({
  x,
  y,
  on,
  size = 'sm',
}: {
  x: number;
  y: number;
  on: boolean;
  size?: 'sm' | 'md';
}) {
  const w = size === 'sm' ? 26 : 34;
  const h = size === 'sm' ? 15 : 20;
  const r = h / 2 - 2;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={h / 2} className={on ? 'fill-brand-500' : 'fill-slate-300'} />
      <circle
        cx={on ? w - h / 2 : h / 2}
        cy={h / 2}
        r={r}
        className="fill-white help-art-as-drawn"
      />
    </g>
  );
}
