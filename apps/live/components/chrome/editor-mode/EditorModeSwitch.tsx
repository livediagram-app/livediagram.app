import type { ComponentType } from 'react';
import type { EditorModeSwitchProps } from './editor-mode-copy';
import type { ModeSwitchVariant } from './mode-switch-variant';
import { ModeSegmented } from './ModeSegmented';
import { ModeIconToggle } from './ModeIconToggle';
import { ModeMenuChip } from './ModeMenuChip';
import { ModeSlider } from './ModeSlider';

// The mode switch (docs/specs/007-editor/editor-modes.md "The mode switch"):
// the tab bar's control for the editor mode, beside the page switcher.
//
// PROTOTYPING: four candidate controls behind one `variant` prop, so the
// operator can compare them in place; the losers go once one is picked.
//
// Zero layout shift: each variant sits in a slot whose width is fixed per
// breakpoint and independent of the mode, so nothing beside it moves when the
// mode changes. `hidden` (a tab that offers no switch) keeps the slot but
// empties it, so the tab pills do not jump when moving between tabs.

const VARIANT: Record<ModeSwitchVariant, ComponentType<EditorModeSwitchProps>> = {
  a: ModeSegmented,
  b: ModeIconToggle,
  c: ModeMenuChip,
  d: ModeSlider,
};

// Phone / `sm`-and-up widths in px: A 76 / 172, B 28, C 44 / 116, D 44 / 104.
const SLOT_WIDTH: Record<ModeSwitchVariant, string> = {
  a: 'w-[76px] sm:w-[172px]',
  b: 'w-7',
  c: 'w-11 sm:w-[116px]',
  d: 'w-11 sm:w-[104px]',
};

type Props = EditorModeSwitchProps & {
  variant: ModeSwitchVariant;
  hidden?: boolean;
};

export function EditorModeSwitch({ variant, hidden = false, mode, onChange }: Props) {
  const slot = `flex shrink-0 ${SLOT_WIDTH[variant]}`;
  if (hidden) return <div data-editor-mode-switch aria-hidden className={slot} />;
  const Variant = VARIANT[variant];
  return (
    <div data-editor-mode-switch className={slot}>
      <Variant mode={mode} onChange={onChange} />
    </div>
  );
}
