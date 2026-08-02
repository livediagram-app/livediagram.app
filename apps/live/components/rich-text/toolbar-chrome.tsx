// The chrome the two rich-text toolbars share: the toggle button's classes,
// the divider between groups, and the run-format toggles themselves.
//
// The label toolbar (RichTextToolbar) and the note toolbar (NoteFormatToolbar)
// already share their block-type dropdown, for the reason ToolbarDropdown
// states: a second copy would drift on the first behaviour fix. These three
// pieces had drifted the other way — they were copied, and the note toolbar's
// own comment said so ("Same h-8 w-8 button as the label toolbar so the two
// read as one system"). A comment promising two files stay alike is a job for
// one file.
//
// `noFocusSteal` belongs to this same family and already lives in
// ToolbarDropdown; the note toolbar had re-declared it rather than importing.

import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@/components/palette/palette-icons';
import type { RunBoolKey } from '@livediagram/diagram';

// `extra` exists for one caller: the note toolbar wraps its buttons
// (flex-wrap), so its buttons take `shrink-0` to keep their square. The label
// toolbar's row does not wrap and deliberately does not pass it.
export function toolbarButtonClass(active: boolean, extra = ''): string {
  return `flex h-8 w-8 ${extra ? extra + ' ' : ''}items-center justify-center rounded-md transition ${
    active
      ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
  }`;
}

// The same spacer the element toolbar's Divider uses, so every toolbar in the
// editor reads alike.
export const TOOLBAR_DIVIDER = (
  <span className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" aria-hidden />
);

export type RunToggle = {
  key: RunBoolKey;
  label: string;
  description: string;
  icon: React.ReactNode;
};

// Every run-format toggle, with the wording each one shows. A toolbar picks
// the subset it offers rather than restating the entries: the label toolbar
// takes all four, the note toolbar the first three (a note has no
// strikethrough).
export const RUN_TOGGLES: Record<RunBoolKey, RunToggle> = {
  bold: { key: 'bold', label: 'Bold', description: 'Bold the selected text.', icon: <BoldIcon /> },
  italic: {
    key: 'italic',
    label: 'Italic',
    description: 'Italicise the selected text.',
    icon: <ItalicIcon />,
  },
  underline: {
    key: 'underline',
    label: 'Underline',
    description: 'Underline the selected text.',
    icon: <UnderlineIcon />,
  },
  strikethrough: {
    key: 'strikethrough',
    label: 'Strikethrough',
    description: 'Strike through the selected text.',
    icon: <StrikethroughIcon />,
  },
};

/** The toggles a toolbar offers, in the order it shows them. */
export function runToggles(...keys: RunBoolKey[]): RunToggle[] {
  return keys.map((k) => RUN_TOGGLES[k]);
}
