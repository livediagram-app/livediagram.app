// The clash mark (docs/specs/026-plan/plan-views.md "Dependency clashes"): an amber disc holding "!", the same on a
// Gantt mark and in the item panel's Blocked By list. Dark ink on amber-500 reads on either surface.
import type { HTMLAttributes } from 'react';
import { GlyphDisc } from '@liveplanner/ui';

export function ClashGlyph({ className = '', ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <GlyphDisc
      size={12}
      className={`bg-amber-500 text-[9px] font-bold text-slate-950 ${className}`}
      {...rest}
    >
      !
    </GlyphDisc>
  );
}
