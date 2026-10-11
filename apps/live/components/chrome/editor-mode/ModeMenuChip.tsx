import { useRef, useState } from 'react';
import {
  EDITOR_MODES,
  crossesPlan,
  editorModeLabel,
  modesBesidePlanRule,
  nextEditorMode,
} from '@livediagram/document';
import {
  CheckIcon,
  ChevronDownIcon,
  useClickOutside,
  useMenu,
  useMenuButton,
  type MenuInitialFocus,
  EDITOR_MODE_ICONS,
  MENU_PANEL,
} from '@livediagram/ui';
import { TOOLBAR_TRIGGER_TONE } from '@/components/palette/PaletteDropdown';
import {
  EDITOR_MODE_KEYSHORTCUT,
  MODE_SWITCH_FOCUS,
  type EditorModeSwitchProps,
} from './editor-mode-copy';
import { ModeKeyHint } from './ModeKeyHint';
import { useConfirm } from '@/hooks/ui/useConfirm';

// The mode switch (docs/specs/007-editor/editor-modes.md "The mode switch"): a dropdown chip
// showing the current mode's glyph and a chevron, that opens a menu DOWNWARD (it sits in
// the top chrome), one compact row per mode from the catalogue (glyph and name, at the
// palette dropdowns' size; no hover card, which would cover the menu), a check on the
// current mode, and Shift+D on the row the key leads to. The chip wears the
// strip's faint dropdown tint (docs/specs/007-editor/toolbar-layout.md "Look"), so it reads as a
// menu. The menu hangs from the chip's left edge, into the room beside the menu button.
//
// Menu button pattern (docs/specs/004-interface-design/menus.md): the chip is a menu button, the rows
// are `menuitemradio`, and the shared hooks give it the menu keyboard: opening focuses the checked
// row, choosing or Escape returns focus to the chip, Tab closes it. An outside press closes it.

// `labelled` shows the mode's name beside its glyph, where the chip has room and no top chrome around it to explain it
// (a start panel's rail).
export function ModeMenuChip({
  mode,
  onChange,
  lockedReason,
  newTabIn,
  crossPlan = false,
  labelled = false,
}: EditorModeSwitchProps & { labelled?: boolean }) {
  const confirm = useConfirm();
  // On a tab that keeps its mode, another mode is a new tab in it, asked first (docs/specs/026-plan/plan-tabs.md).
  const pickLocked = async (next: EditorModeSwitchProps['mode']) => {
    const name = editorModeLabel(next);
    // Plan stands apart (crossesPlan): a tab never switches into or out of it.
    const why =
      lockedReason ??
      (mode === 'plan' ? 'A Plan tab stays in Plan.' : 'Plan works in tabs of its own.');
    const ok = await confirm({
      title: `Open a New ${name} Tab?`,
      message: `${why} Its mode can’t change, but you can carry on in a new ${name} tab.`,
      confirmLabel: `New ${name} Tab`,
    });
    if (ok) newTabIn?.(next);
  };
  const {
    open,
    close,
    toggle,
    initialFocus,
    trigger: chip,
    onTriggerKeyDown,
    setTrigger,
  } = useMenuButton();
  const root = useRef<HTMLDivElement>(null);
  const Icon = EDITOR_MODE_ICONS[mode];
  const label = editorModeLabel(mode);
  const modes = EDITOR_MODES;
  const besides = crossPlan ? modes : modesBesidePlanRule(mode);
  const keyLeadsTo = besides.length > 1 ? nextEditorMode(mode, 1, besides) : null;

  // The zoom the chip's host draws at (the toolbar or panel UI scale, docs/specs/007-editor/ui-scale.md),
  // read when the menu opens; the menu undoes it, so it opens at design size like every menu
  // opened from a scaled surface.
  const [hostZoom, setHostZoom] = useState(1);
  const readZoom = () => {
    if (chip) setHostZoom(effectiveZoom(chip));
  };

  useClickOutside(root, close, open);

  return (
    <div ref={root} className="relative w-full">
      {/* No hover card: it would sit over the menu the chip opens. The menu itself names the
          modes and shows Shift+D, and the chip keeps its accessible name. */}
      <button
        ref={setTrigger}
        type="button"
        // The tours' anchor is the top chrome's chip, never a start panel's.
        data-tour-id={labelled ? undefined : 'editor-mode'}
        aria-haspopup="menu"
        aria-expanded={open}
        // A start screen's switch is named for the tab it sets, so the top chrome's "Editor mode" stays the one.
        aria-label={labelled ? `Tab mode: ${label}` : `Editor mode: ${label}`}
        aria-keyshortcuts={EDITOR_MODE_KEYSHORTCUT}
        onClick={() => {
          readZoom();
          toggle();
        }}
        onKeyDown={(event) => {
          if (!open) readZoom();
          onTriggerKeyDown(event);
        }}
        // Labelled, it is a full-bleed row filling the edge it sits on (a start panel's rail top): square, taller,
        // its focus ring drawn inside so the panel's edge never clips it.
        className={`flex w-full items-center transition-colors ${
          labelled
            ? 'h-12 justify-start gap-2.5 rounded-none px-5 text-[13px] font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-400'
            : `h-9 justify-center gap-1 rounded-md px-1.5 ${MODE_SWITCH_FOCUS}`
        } ${TOOLBAR_TRIGGER_TONE}`}
      >
        <Icon aria-hidden />
        {labelled ? <span className="flex-1 text-left">{label}</span> : null}
        <ChevronDownIcon
          aria-hidden
          className={`transition-transform duration-micro motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open ? (
        <ModeMenu
          mode={mode}
          modes={modes}
          keyLeadsTo={keyLeadsTo}
          chip={chip}
          initialFocus={initialFocus}
          hostZoom={hostZoom}
          onChange={onChange}
          onClose={close}
          crossPlan={crossPlan}
          lockedReason={lockedReason}
          // No new tab to offer (a session that cannot add tabs, such as a tab-scoped link): the
          // locked rows are inert.
          {...(newTabIn
            ? { onLockedPick: (next: EditorModeSwitchProps['mode']) => void pickLocked(next) }
            : {})}
        />
      ) : null}
    </div>
  );
}

function ModeMenu({
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
}: {
  crossPlan: boolean;
  mode: EditorModeSwitchProps['mode'];
  modes: readonly EditorModeSwitchProps['mode'][];
  keyLeadsTo: EditorModeSwitchProps['mode'] | null;
  chip: HTMLElement | null;
  initialFocus: MenuInitialFocus;
  hostZoom: number;
  onChange: EditorModeSwitchProps['onChange'];
  onClose: () => void;
  lockedReason?: string | undefined;
  onLockedPick?: (mode: EditorModeSwitchProps['mode']) => void;
}) {
  const { attach, surfaceProps } = useMenu({
    onClose,
    trigger: chip,
    initialFocus,
    label: 'Editor mode',
  });
  return (
    <div
      ref={attach}
      {...surfaceProps}
      data-tour-id="editor-mode-menu"
      style={hostZoom === 1 ? undefined : { zoom: 1 / hostZoom }}
      className={`absolute left-0 top-full z-(--z-popover) mt-1.5 w-max min-w-36 outline-none ${MENU_PANEL}`}
    >
      {modes.map((option) => {
        const checked = option === mode;
        const locked = (!!lockedReason && !checked) || (!crossPlan && crossesPlan(mode, option));
        // A locked row with no new tab to offer does nothing.
        const inert = locked && !onLockedPick;
        const RowIcon = EDITOR_MODE_ICONS[option];
        return (
          <button
            key={option}
            type="button"
            role="menuitemradio"
            aria-checked={checked}
            aria-disabled={inert || undefined}
            tabIndex={-1}
            onClick={() => {
              if (inert) return;
              onClose();
              if (locked) onLockedPick?.(option);
              else if (!checked) onChange(option);
            }}
            className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${MODE_SWITCH_FOCUS} ${
              checked
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                : inert
                  ? 'cursor-not-allowed text-slate-600 opacity-50 dark:text-slate-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <RowIcon size={16} aria-hidden className="shrink-0" />
            <span className="flex-1">{editorModeLabel(option)}</span>
            <span className="flex w-7 shrink-0 justify-end">
              {checked ? <CheckIcon aria-hidden /> : null}
              {option === keyLeadsTo && !checked && !lockedReason ? <ModeKeyHint /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// The effective CSS zoom an element draws at (its own and its ancestors'): `currentCSSZoom` where
// the browser has it, else its screen width over its layout width. 1 when it cannot be read.
function effectiveZoom(el: HTMLElement): number {
  const current = (el as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom;
  if (typeof current === 'number' && current > 0) return current;
  const width = el.offsetWidth;
  const zoom = width > 0 ? el.getBoundingClientRect().width / width : 1;
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}
