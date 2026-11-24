'use client';

import { useId } from 'react';
import { useClosePhoneApps } from '@liveworkspace/workbench/components/chrome/phone-apps/phone-apps-section';
import { EDITOR_MODES, editorModeLabel, type EditorMode } from '@livediagram/document';
import { EDITOR_MODE_ICONS } from '@livediagram/ui';
import { MODE_SWITCH_FOCUS } from './editor-mode-copy';
import { MODE_TINT } from './mode-menu-copy';

// The mode switch in the phone's Apps drawer (docs/specs/007-editor/editor-modes.md "The mode switch", and
// liveworkspace/docs/specs/011-workbench/phone-apps-drawer.md "The app's section"): on a phone the top row no longer holds
// the mode chip, so the drawer leads with the three modes side by side, the current one marked. A radio group: one
// press switches, as a row of the mode menu does, and closes the drawer first so the new mode shows.
export function PhoneModePicker({
  mode,
  onChange,
}: {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
}) {
  const labelId = useId();
  const closeDrawer = useClosePhoneApps();
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-xs font-medium text-slate-600 dark:text-slate-300">
        Editor mode
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        data-phone-mode-picker=""
        className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
      >
        {EDITOR_MODES.map((option) => {
          const Icon = EDITOR_MODE_ICONS[option];
          const on = option === mode;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={on}
              data-mode-option={option}
              onClick={() => {
                if (on) return;
                closeDrawer();
                onChange(option);
              }}
              className={`flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg text-[13px] transition-colors ${MODE_SWITCH_FOCUS} ${
                on
                  ? 'bg-white font-semibold text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-md ${MODE_TINT[option]}`}
              >
                <Icon size={14} aria-hidden />
              </span>
              {editorModeLabel(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
