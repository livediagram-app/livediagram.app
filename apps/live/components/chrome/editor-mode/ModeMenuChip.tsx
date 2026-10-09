import { useRef, useState } from 'react';
import { EDITOR_MODES, editorModeLabel, nextEditorMode } from '@livediagram/document';
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

export function ModeMenuChip({ mode, onChange }: EditorModeSwitchProps) {
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
  const keyLeadsTo = nextEditorMode(mode, 1);

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
        data-tour-id="editor-mode"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Editor mode: ${label}`}
        aria-keyshortcuts={EDITOR_MODE_KEYSHORTCUT}
        onClick={() => {
          readZoom();
          toggle();
        }}
        onKeyDown={(event) => {
          if (!open) readZoom();
          onTriggerKeyDown(event);
        }}
        className={`flex w-full items-center gap-1 rounded-md px-1.5 transition-colors h-9 justify-center ${TOOLBAR_TRIGGER_TONE} ${MODE_SWITCH_FOCUS}`}
      >
        <Icon aria-hidden />
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
}: {
  mode: EditorModeSwitchProps['mode'];
  modes: readonly EditorModeSwitchProps['mode'][];
  keyLeadsTo: EditorModeSwitchProps['mode'];
  chip: HTMLElement | null;
  initialFocus: MenuInitialFocus;
  hostZoom: number;
  onChange: EditorModeSwitchProps['onChange'];
  onClose: () => void;
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
        const RowIcon = EDITOR_MODE_ICONS[option];
        return (
          <button
            key={option}
            type="button"
            role="menuitemradio"
            aria-checked={checked}
            tabIndex={-1}
            onClick={() => {
              if (!checked) onChange(option);
              onClose();
            }}
            className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${MODE_SWITCH_FOCUS} ${
              checked
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <RowIcon size={16} aria-hidden className="shrink-0" />
            <span className="flex-1">{editorModeLabel(option)}</span>
            <span className="flex w-7 shrink-0 justify-end">
              {checked ? <CheckIcon aria-hidden /> : null}
              {option === keyLeadsTo && !checked ? <ModeKeyHint /> : null}
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
