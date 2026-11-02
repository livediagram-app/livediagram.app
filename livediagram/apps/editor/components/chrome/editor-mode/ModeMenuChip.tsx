import { useRef, useState } from 'react';
import { EDITOR_MODES, editorModeLabel, nextEditorMode } from '@livediagram/document';
import {
  ChevronDownIcon,
  useClickOutside,
  useMenuButton,
  EDITOR_MODE_ICONS,
} from '@livediagram/ui';
import { TOOLBAR_TRIGGER_TONE } from '@liveworkspace/workbench/components/palette/PaletteDropdown';
import {
  EDITOR_MODE_KEYSHORTCUT,
  MODE_SWITCH_FOCUS,
  type EditorModeSwitchProps,
} from './editor-mode-copy';
import { ModeMenu } from './ModeMenu';

// The mode switch (docs/specs/007-editor/editor-modes.md "The mode switch"): a dropdown chip showing the current
// mode's glyph, its name and a chevron, that opens the mode menu (ModeMenu) DOWNWARD, hanging from the chip's left edge:
// a list of the modes and a preview of one. No hover card, which would cover the menu. The chip
// wears the strip's faint dropdown tint (docs/specs/007-editor/toolbar-layout.md "Look"), so it
// reads as a menu.
//
// Menu button pattern (docs/specs/004-interface-design/menus.md): the chip is a menu button, the rows
// are `menuitemradio`, and the shared hooks give it the menu keyboard: opening focuses the checked
// row, choosing or Escape returns focus to the chip, Tab closes it. An outside press closes it.
//
// Two forms: `compact`, the top chrome's chip beside the menu button (EditorModeSwitch), named "Editor mode", its
// label dropped where `iconOnly` (a phone); else a start panel's full-bleed rail row, named "Tab mode", so the two
// never share a name while both show.
export function ModeMenuChip({
  mode,
  onChange,
  compact = false,
  iconOnly = false,
}: EditorModeSwitchProps & { compact?: boolean; iconOnly?: boolean }) {
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
  const keyLeadsTo = nextEditorMode(mode, 1, modes);

  // The zoom the chip's host draws at (the toolbar or panel UI scale, docs/specs/007-editor/ui-scale.md),
  // read when the menu opens; the menu undoes it, so it opens at design size like every menu
  // opened from a scaled surface.
  const [hostZoom, setHostZoom] = useState(1);
  const readZoom = () => {
    if (chip) setHostZoom(effectiveZoom(chip));
  };

  // The top chrome's menu is portalled out of `root`; a press on it is still inside.
  useClickOutside(root, close, open, '[data-mode-menu]');

  return (
    <div ref={root} className="relative w-full">
      {/* No hover card: it would sit over the menu the chip opens. The menu itself names the
          modes and shows Shift+D, and the chip keeps its accessible name. */}
      <button
        ref={setTrigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        // The rail's is named for the tab it sets; the top chrome's for the editor.
        aria-label={`${compact ? 'Editor' : 'Tab'} mode: ${label}`}
        aria-keyshortcuts={EDITOR_MODE_KEYSHORTCUT}
        onClick={() => {
          readZoom();
          toggle();
        }}
        onKeyDown={(event) => {
          if (!open) readZoom();
          onTriggerKeyDown(event);
        }}
        // Compact: a toolbar-height chip in the menu card. Else a full-bleed row filling the edge it sits on (a start
        // panel's rail top): square, tall, its focus ring drawn inside so the panel's edge never clips it.
        className={`flex w-full items-center transition-colors ${
          compact
            ? `h-9 justify-start gap-1.5 rounded-md px-2 text-[13px] font-medium ${MODE_SWITCH_FOCUS}`
            : 'h-12 justify-start gap-2.5 rounded-none px-5 text-[13px] font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-400'
        } ${TOOLBAR_TRIGGER_TONE}`}
      >
        <Icon aria-hidden />
        {iconOnly ? null : <span className="text-optical-line flex-1 text-left">{label}</span>}
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
          // The rail's menu spans its row on a phone; the top chrome's chip is too narrow to span.
          fill={!compact}
        />
      ) : null}
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
