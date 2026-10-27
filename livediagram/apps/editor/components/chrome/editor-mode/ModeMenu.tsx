import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { editorModeDescription, editorModeLabel } from '@livediagram/document';
import {
  CheckIcon,
  EDITOR_MODE_ICONS,
  MENU_PANEL,
  POPOVER_VIEWPORT_MARGIN,
  Portal,
  clampIntoRange,
  useMenu,
  type MenuInitialFocus,
} from '@livediagram/ui';
import { MODE_SWITCH_FOCUS, type EditorModeSwitchProps } from './editor-mode-copy';
import { MODE_TINT, MODE_TOOLS, type ModeMenuAction } from './mode-menu-copy';
import { ModeKeyHint } from './ModeKeyHint';
import { ModePreviewArt } from './ModePreviewArt';

type Mode = EditorModeSwitchProps['mode'];

// The mode menu (docs/specs/007-editor/editor-modes.md "The mode switch"): two panes, a list of the
// modes and a preview of one. The list's rows are the menu's `menuitemradio` items, each its mark on
// the mode's tint, its name, then a check on the current mode.
// The preview follows the pointer, else focus, else the current mode: a picture, the description,
// the main tools. Choosing is the row's alone (a click, or Enter or Space on the focused row). The
// preview is for the pointer, so it is hidden from assistive technology, which hears each row's
// description on the row (aria-describedby).
// Under 640px the preview is left out and the list stands alone, each row showing its description.
//
// Opened by ModeMenuChip, in the top chrome and on every start panel's rail, so both show the same menu.
//
// The top chrome's menu (not `fill`) mounts in a Portal, fixed below the chip and kept POPOVER_VIEWPORT_MARGIN inside
// the viewport: inside the menu card it sat under the canvas's own overlays (the empty tab's tray) and ran off a
// phone's right edge. It is placed once it has a size, and again on a resize; hidden until then so it never flashes.
// A Portal is not scaled by the toolbar's UI scale, so it needs no zoom undoing. `data-mode-menu` lets the chip's
// outside-press check count a press on the menu as inside.
export function ModeMenu({
  mode,
  modes,
  keyLeadsTo,
  chip,
  initialFocus,
  hostZoom,
  onChange,
  onClose,
  fill = false,
}: {
  mode: Mode;
  modes: readonly Mode[];
  keyLeadsTo: Mode | null;
  chip: HTMLElement | null;
  initialFocus: MenuInitialFocus;
  hostZoom: number;
  onChange: EditorModeSwitchProps['onChange'];
  onClose: () => void;
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

  const actionOf = (option: Mode): ModeMenuAction => (option === mode ? 'current' : 'switch');
  const choose = (option: Mode) => {
    onClose();
    if (actionOf(option) === 'switch') onChange(option);
  };

  const panel = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (fill || !chip) return;
    const measure = () => {
      const rect = chip.getBoundingClientRect();
      const width = panel.current?.offsetWidth ?? 0;
      const max = window.innerWidth - width - POPOVER_VIEWPORT_MARGIN;
      setPlace({
        top: rect.bottom + 6,
        left: clampIntoRange(rect.left, POPOVER_VIEWPORT_MARGIN, max),
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [fill, chip]);

  const floating = !fill;
  const style: CSSProperties | undefined = floating
    ? place
      ? { top: place.top, left: place.left }
      : { top: 0, left: 0, visibility: 'hidden' }
    : hostZoom === 1
      ? undefined
      : { zoom: 1 / hostZoom };
  const position = floating
    ? 'fixed z-(--z-popover) w-max min-w-56 max-w-[calc(100vw-1rem)]'
    : 'absolute left-0 top-full z-(--z-popover) mt-1.5 w-max min-w-56 max-w-[calc(100vw-2rem)] max-sm:inset-x-2 max-sm:w-auto';

  const menu = (
    <div
      ref={(node) => {
        panel.current = node;
        attach(node);
      }}
      {...surfaceProps}
      data-tour-id="editor-mode-menu"
      data-mode-menu=""
      style={style}
      className={`${position} outline-none sm:flex-row sm:p-0 ${MENU_PANEL}`}
    >
      <div className="flex flex-col gap-px max-sm:gap-0.5 sm:w-48 sm:shrink-0 sm:border-r sm:border-slate-200 sm:p-1.5 dark:sm:border-slate-700">
        {modes.map((option) => {
          const action = actionOf(option);
          const checked = action === 'current';
          const RowIcon = EDITOR_MODE_ICONS[option];
          const describedBy = `${ids}-${option}`;
          return (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={checked}
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
              } ${
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
                </span>
              </span>
              <span className="flex w-5 shrink-0 justify-end">
                {checked ? (
                  <CheckIcon aria-hidden className="text-brand-700 dark:text-brand-400" />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <ModePreview mode={shown} keyLeads={shown === keyLeadsTo} />
    </div>
  );
  return floating ? <Portal>{menu}</Portal> : menu;
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
