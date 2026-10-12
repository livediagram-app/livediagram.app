'use client';

// The Tab Look & Feel dialog's Finish tab (docs/specs/008-canvas/finish.md "Where it is set"): the tab's
// finish as three tiles, applied live, and Apply to All Elements, which clears every element's own finish so
// the whole tab follows it again.

import { DEFAULT_FINISH, FINISHES, type Finish } from '@livediagram/document';
import { Button, Glyph } from '@livediagram/ui';
import { SizeButton } from '@/components/palette/palette-controls';
import { FINISH_LABELS, FinishSwatch } from '@/components/palette/FinishSection';

export function FinishTab({
  finish,
  onSetFinish,
  onApplyFinishToAll,
}: {
  // The tab's finish; undefined reads as Flexible.
  finish: Finish | undefined;
  onSetFinish: (finish: Finish) => void;
  onApplyFinishToAll: () => void;
}) {
  const current = finish ?? DEFAULT_FINISH;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Finish
        </span>
        <div className="grid grid-cols-3 gap-2">
          {FINISHES.map((f) => (
            <SizeButton key={f} active={current === f} onClick={() => onSetFinish(f)}>
              <span className="flex flex-col items-center gap-1 py-1">
                <FinishSwatch finish={f} />
                <span className="text-[11px] font-medium">{FINISH_LABELS[f]}</span>
              </span>
            </SizeButton>
          ))}
        </div>
        <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          How lines, corners and lettering are drawn on this tab.
        </p>
      </div>
      <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
        <Button variant="secondary" size="xs" onClick={onApplyFinishToAll}>
          Apply to All Elements
        </Button>
      </div>
    </div>
  );
}

// The dialog tab strip's glyph: a pencil drawing a line.
export function FinishTabIcon() {
  return (
    <Glyph size={14} units={16}>
      <path d="M10.5 2.5l3 3L6 13H3v-3z" />
    </Glyph>
  );
}
