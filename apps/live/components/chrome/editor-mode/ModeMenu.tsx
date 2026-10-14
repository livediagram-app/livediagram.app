import { useId, useState } from 'react';
import { crossesPlan, editorModeDescription, editorModeLabel } from '@livediagram/document';
import {
  CheckIcon,
  EDITOR_MODE_ICONS,
  MENU_PANEL,
  useMenu,
  type MenuInitialFocus,
} from '@livediagram/ui';
import { MODE_SWITCH_FOCUS, type EditorModeSwitchProps } from './editor-mode-copy';
import { MODE_TINT, MODE_TOOLS, type ModeMenuAction } from './mode-menu-copy';
import { ModeKeyHint } from './ModeKeyHint';
import { ModePreviewArt } from './ModePreviewArt';
import { OpenIcon } from '@/components/primitives/explorer-icons';

type Mode = EditorModeSwitchProps['mode'];

// The mode menu (docs/specs/007-editor/editor-modes.md "The mode switch"): two panes, a list of the
// modes and a preview of one. The list's rows are the menu's `menuitemradio` items, each its mark on
// the mode's tint, its name, then a check on the current mode or a New tab mark across Plan's line.
// The preview follows the pointer, else focus, else the current mode: a picture, the description,
// the main tools. Choosing is the row's alone (a click, or Enter or Space on the focused row). The
// preview is for the pointer, so it is hidden from assistive technology, which hears each row's
// description on the row (aria-describedby).
// Under 640px the preview is left out and the list stands alone, each row showing its description.
//
// Opened by ModeMenuChip, in the top chrome and on every start panel's rail, so both show the same menu.
export function ModeMenu({
  mode,
  modes,
  keyLeadsTo,
  chip,
  initialFocus,
  hostZoom,
  onChange,
  onClose,
  crossPlan,
  lockedReason,
  onLockedPick,
  fill = false,
}: {
  crossPlan: boolean;
  mode: Mode;
  modes: readonly Mode[];
  keyLeadsTo: Mode | null;
  chip: HTMLElement | null;
  initialFocus: MenuInitialFocus;
  hostZoom: number;
  onChange: EditorModeSwitchProps['onChange'];
  onClose: () => void;
  lockedReason?: string | undefined;
  onLockedPick?: (mode: Mode) => void;
  // A start panel's labelled switch: on a phone the menu spans the row it opens from, its descriptions running the
  // full width (the top chrome's chip is too narrow to span).
  fill?: boolean;
}) {
  const { attach, surfaceProps } = useMenu({
    onClose,
    trigger: chip,
    initialFocus,
    label: 'Editor mode',
  });
  const ids = useId();
  // The mode the preview shows: the last row pointed at or focused, the current mode until then.
  const [shown, setShown] = useState<Mode>(mode);

  // Across a lock (the tab keeps its mode, or Plan's line) a row offers a new tab instead; with no
  // new tab to offer (a session that cannot add tabs) it is inert.
  const actionOf = (option: Mode): ModeMenuAction => {
    if (option === mode) return 'current';
    const locked = !!lockedReason || (!crossPlan && crossesPlan(mode, option));
    if (!locked) return 'switch';
    return onLockedPick ? 'new-tab' : 'inert';
  };
  const choose = (option: Mode) => {
    const action = actionOf(option);
    if (action === 'inert') return;
    onClose();
    if (action === 'new-tab') onLockedPick?.(option);
    else if (action === 'switch') onChange(option);
  };

  return (
    <div
      ref={attach}
      {...surfaceProps}
      data-tour-id="editor-mode-menu"
      style={hostZoom === 1 ? undefined : { zoom: 1 / hostZoom }}
      className={`absolute left-0 top-full z-(--z-popover) mt-1.5 w-max min-w-56 max-w-[calc(100vw-2rem)] outline-none sm:flex-row sm:p-0 ${fill ? 'max-sm:inset-x-2 max-sm:w-auto' : ''} ${MENU_PANEL}`}
    >
      <div className="flex flex-col gap-px max-sm:gap-0.5 sm:w-48 sm:shrink-0 sm:border-r sm:border-slate-200 sm:p-1.5 dark:sm:border-slate-700">
        {modes.map((option) => {
          const action = actionOf(option);
          const checked = action === 'current';
          const inert = action === 'inert';
          const RowIcon = EDITOR_MODE_ICONS[option];
          const describedBy = `${ids}-${option}`;
          return (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={checked}
              aria-disabled={inert || undefined}
              aria-describedby={describedBy}
              data-mode-row={option}
              data-shown={option === shown || undefined}
              tabIndex={-1}
              onPointerEnter={() => setShown(option)}
              onFocus={() => setShown(option)}
              onClick={() => choose(option)}
              className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors max-sm:gap-3 max-sm:px-2.5 max-sm:py-2.5 ${MODE_SWITCH_FOCUS} ${
                checked
                  ? 'font-semibold text-slate-900 dark:text-white'
                  : 'font-medium text-slate-600 dark:text-slate-300'
              } ${inert ? 'cursor-not-allowed opacity-50' : ''} ${
                option === shown
                  ? 'bg-slate-100 dark:bg-slate-800'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span
                className={`flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-md max-sm:h-8 max-sm:w-8 ${MODE_TINT[option]}`}
              >
                <RowIcon size={15} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col max-sm:gap-0.5">
                {editorModeLabel(option)}
                {/* Shown under the name where there is no preview (under 640px); read by assistive
                    technology as the row's description everywhere. */}
                <span
                  id={describedBy}
                  className={`${fill ? '' : 'max-w-60'} text-xs font-normal leading-snug text-slate-500 sm:sr-only dark:text-slate-400`}
                >
                  {editorModeDescription(option)}
                  {action === 'new-tab' ? ' Opens in a new tab.' : ''}
                </span>
              </span>
              <span className="flex w-5 shrink-0 justify-end">
                {checked ? (
                  <CheckIcon aria-hidden className="text-brand-700 dark:text-brand-400" />
                ) : action === 'new-tab' ? (
                  <OpenIcon aria-hidden data-new-tab-mark className="text-slate-400" />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <ModePreview mode={shown} keyLeads={shown === keyLeadsTo && !lockedReason} />
    </div>
  );
}

// The preview pane: hidden under 640px, and from assistive technology (the rows carry its words).
function ModePreview({ mode, keyLeads }: { mode: Mode; keyLeads: boolean }) {
  const label = editorModeLabel(mode);
  return (
    <div
      aria-hidden
      data-mode-preview={mode}
      className="hidden w-72 flex-col gap-2.5 p-3.5 sm:flex"
    >
      <div className={`flex h-24 items-center justify-center rounded-lg ${MODE_TINT[mode]}`}>
        <ModePreviewArt mode={mode} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-semibold text-slate-900 dark:text-white">{label}</span>
        {keyLeads ? <ModeKeyHint /> : null}
      </div>
      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        {editorModeDescription(mode)}
      </p>
      <ul className="flex flex-wrap gap-1">
        {MODE_TOOLS[mode].map((tool) => (
          <li
            key={tool}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {tool}
          </li>
        ))}
      </ul>
    </div>
  );
}
