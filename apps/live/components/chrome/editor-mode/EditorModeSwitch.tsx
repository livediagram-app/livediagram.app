import type { EditorModeSwitchProps } from './editor-mode-copy';
import { ModeIconPill } from './ModeIconPill';
import { ModeMenuChip } from './ModeMenuChip';

// The mode switch (docs/specs/007-editor/editor-modes.md "The mode switch"): the tab bar's control
// for the editor mode, beside the page switcher. A dropdown chip for everyone; in power user mode
// (`compact`) an icon-only segmented pill (docs/specs/007-editor/power-user-mode.md "Quick mode
// switch").
//
// Zero layout shift: both forms sit in one slot whose width is fixed per breakpoint, whatever the
// mode and whichever the form, so nothing beside it moves when the mode changes or power user mode
// is switched. `hidden` (a tab that offers no switch) keeps the slot but empties it, so the tab
// pills do not jump when moving between tabs.

// Phone: room for the pill's two 36px segments (the chip shows glyph + chevron). `sm` and up: the
// chip's glyph, longest mode name and chevron.
const SLOT = 'flex shrink-0 w-[76px] sm:w-[116px]';

type Props = EditorModeSwitchProps & {
  compact?: boolean;
  hidden?: boolean;
};

export function EditorModeSwitch({ compact = false, hidden = false, mode, onChange }: Props) {
  if (hidden) return <div data-editor-mode-switch aria-hidden className={SLOT} />;
  const Form = compact ? ModeIconPill : ModeMenuChip;
  return (
    <div data-editor-mode-switch className={SLOT}>
      <Form mode={mode} onChange={onChange} />
    </div>
  );
}
