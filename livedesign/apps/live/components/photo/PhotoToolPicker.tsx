'use client';

// The options flyout's Tool section (docs/specs/031-photo/photo-pages.md "The options flyout"): the tools of the group
// in hand (Brush and Pencil, the three lassos) as tiles, so another is a press away, never a long press.
import type { PhotoToolId } from '@/lib/photo-editor/tool-state';
import { TOOL_NAMES } from '@/lib/photo-editor/tool-state';
import { TOOL_BLURBS } from '@/lib/photo-editor/option-guides';
import type { Pointed } from './flyout-controls';
import { TOOL_ICONS } from './photo-icons';
import { takeTool } from './PhotoToolsRail';

/** The tools of the group in hand, as tiles: a press takes another (photo-pages.md "The options flyout"). */
export function PhotoToolPicker({
  tools,
  tool,
  onPoint,
}: {
  tools: readonly PhotoToolId[];
  tool: PhotoToolId;
  onPoint: (p: Pointed) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Tool"
      style={{ gridTemplateColumns: `repeat(${tools.length}, minmax(0, 1fr))` }}
      className="grid gap-1.5"
    >
      {tools.map((t) => {
        const Icon = TOOL_ICONS[t];
        const on = t === tool;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={TOOL_NAMES[t]}
            onClick={() => takeTool(t)}
            onPointerEnter={() => onPoint({ name: TOOL_NAMES[t], text: TOOL_BLURBS[t] ?? '' })}
            className={`group flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 ring-1 transition ${
              on
                ? 'bg-brand-50 text-brand-700 ring-brand-300 dark:bg-brand-500/20 dark:text-brand-100 dark:ring-brand-500/50'
                : 'text-slate-600 ring-slate-200/80 hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800/70'
            }`}
          >
            <span
              aria-hidden
              className="transition-transform duration-micro group-hover:-translate-y-0.5"
            >
              <Icon />
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium leading-tight">
              {TOOL_NAMES[t]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
